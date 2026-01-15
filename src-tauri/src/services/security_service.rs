use std::io;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use rusqlite::backup::Backup;
use rusqlite::Connection;
use rusqlite::OpenFlags;
use rusqlite::ffi;
use rusqlite::serialize::OwnedData;
use rusqlite::DatabaseName;
use zeroize::{Zeroize, Zeroizing};

use crate::app_state::{AppState, VaultSession};
use crate::data::crypto::{cipher, kdf, key_check};
use crate::data::fs::atomic_write::write_atomic;
use crate::data::profiles::paths::{
    ensure_profile_dirs, kdf_salt_path, key_check_path, profile_dir, vault_db_path,
};
use crate::data::profiles::registry;
use crate::data::sqlite::init::init_database_passwordless;
use crate::data::sqlite::migrations;
use crate::data::sqlite::pool::{clear_pool, drain_and_drop_profile_pools, MaintenanceGuard};
use crate::error::{ErrorCodeString, Result};
use crate::services::attachments_service;
use crate::types::ProfileMeta;

fn format_rusqlite_error(err: &rusqlite::Error) -> String {
    match err {
        rusqlite::Error::SqliteFailure(e, msg) => {
            let m = msg.as_deref().unwrap_or("");
            format!(
                "SqliteFailure(code={:?}, extended_code={}, message={})",
                e.code, e.extended_code, m
            )
        }
        other => format!("{other:?}"),
    }
}

fn classify_db_error(err: &rusqlite::Error) -> ErrorCodeString {
    match err {
        rusqlite::Error::SqliteFailure(e, _) => {
            use rusqlite::ErrorCode::*;
            match e.code {
                DatabaseBusy | DatabaseLocked => ErrorCodeString::new("DB_BUSY"),
                _ => ErrorCodeString::new("DB_QUERY_FAILED"),
            }
        }
        _ => ErrorCodeString::new("DB_QUERY_FAILED"),
    }
}

fn owned_data_from_bytes(mut bytes: Vec<u8>) -> Result<OwnedData> {
    if bytes.is_empty() {
        return Err(ErrorCodeString::new("EMPTY_SERIALIZED_DB"));
    }

    let mem = unsafe { ffi::sqlite3_malloc64(bytes.len() as u64) };
    if mem.is_null() {
        return Err(ErrorCodeString::new("SQLITE_OOM"));
    }

    let owned = unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), mem as *mut u8, bytes.len());
        OwnedData::from_raw_nonnull(NonNull::new_unchecked(mem as *mut u8), bytes.len())
    };

    bytes.zeroize();
    Ok(owned)
}

fn apply_in_memory_pragmas(conn: &rusqlite::Connection, profile_id: &str, ctx: &str) -> Result<()> {
    // Keep this minimal and non-invasive. Setting journal_mode can itself trigger SQLITE_CANTOPEN
    // if the deserialized image is marked as WAL and SQLite attempts to open sidecars.
    conn.execute_batch(
        "PRAGMA temp_store=MEMORY;
PRAGMA synchronous=OFF;
",
    )
    .map_err(|e| {
        log::error!(
            "[SECURITY][pragmas] profile_id={} ctx={} err={}",
            profile_id,
            ctx,
            format_rusqlite_error(&e)
        );
        classify_db_error(&e)
    })
}

fn normalize_sqlite_header_disable_wal(bytes: &mut [u8], profile_id: &str, ctx: &str) {
    // SQLite header magic: "SQLite format 3\0"
    const MAGIC: &[u8; 16] = b"SQLite format 3\0";
    if bytes.len() < 20 {
        return;
    }
    if &bytes[..16] != MAGIC {
        return;
    }

    // As per SQLite documentation/notes: WAL mode persistence is reflected in the DB header bytes.
    // Values 2 at offsets 18/19 indicate WAL read/write versions. Setting them to 1 disables WAL
    // expectations and prevents attempts to open -wal/-shm for deserialized in-memory images.
    // (This is safe for our use-case because we always serialize a consistent image.)
    let mut changed = false;
    if bytes[18] == 2 {
        bytes[18] = 1;
        changed = true;
    }
    if bytes[19] == 2 {
        bytes[19] = 1;
        changed = true;
    }
    if changed {
        log::warn!(
            "[SECURITY][sqlite_header] profile_id={} ctx={} action=disable_wal_header_bytes",
            profile_id,
            ctx
        );
    }
}

fn open_protected_vault_session(
    profile_id: &str,
    password: &str,
    storage_paths: &crate::data::storage_paths::StoragePaths,
    state: &Arc<AppState>,
) -> Result<()> {
    let salt_path = kdf_salt_path(storage_paths, profile_id)?;
    if !salt_path.exists() {
        return Err(ErrorCodeString::new("KDF_SALT_MISSING"));
    }
    let salt =
        std::fs::read(&salt_path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    let key = Zeroizing::new(kdf::derive_master_key(password, &salt)?);

    if !key_check::verify_key_check_file(storage_paths, profile_id, &key)? {
        return Err(ErrorCodeString::new("INVALID_PASSWORD"));
    }

    let vault_path = vault_db_path(storage_paths, profile_id)?;
    if !vault_path.exists() {
        return Err(ErrorCodeString::new("VAULT_CORRUPTED"));
    }
    let encrypted = cipher::read_encrypted_file(&vault_path)?;
    let decrypted = cipher::decrypt_vault_blob(profile_id, &key, &encrypted)
        .map_err(|_| ErrorCodeString::new("VAULT_DECRYPT_FAILED"))?;

    // If the stored DB image is marked WAL, SQLite may try to open -wal/-shm even for :memory:
    // deserialization and fail with SQLITE_CANTOPEN (14). Normalize header before deserialize.
    let mut decrypted = decrypted;
    normalize_sqlite_header_disable_wal(decrypted.as_mut_slice(), profile_id, "unlock_before_deserialize");

    let mut conn = rusqlite::Connection::open_in_memory().map_err(|e| {
        log::error!(
            "[SECURITY][login] profile_id={} step=open_in_memory err={}",
            profile_id,
            format_rusqlite_error(&e)
        );
        ErrorCodeString::new("DB_OPEN_FAILED")
    })?;
    // Set pragmas BEFORE deserialize to avoid temp file writes during the first statements.
    apply_in_memory_pragmas(&conn, profile_id, "open_in_memory_before_deserialize")?;
    let owned = owned_data_from_bytes(decrypted)?;
    conn.deserialize(DatabaseName::Main, owned, false).map_err(|e| {
        log::error!(
            "[SECURITY][login] profile_id={} step=deserialize err={}",
            profile_id,
            format_rusqlite_error(&e)
        );
        ErrorCodeString::new("VAULT_CORRUPTED")
    })?;
    if let Err(e) = migrations::migrate_to_latest(&conn) {
        log::error!(
            "[SECURITY][login] profile_id={} step=migrate_to_latest failed code={}",
            profile_id,
            e.code
        );
        return Err(e);
    }
    migrations::validate_core_schema(&conn)
        .map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;

    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_LOCK_POISONED"))?;

        *session = Some(VaultSession {
            profile_id: profile_id.to_string(),
            conn,
            key,
        });
    }

    Ok(())
}

fn cleanup_sqlite_sidecars(vault_path: &Path) {
    // After converting passwordless (sqlite file) -> protected (encrypted blob),
    // old WAL/SHM sidecars may remain. Remove best-effort.
    if let Some(p) = vault_path.to_str() {
        let wal = format!("{p}-wal");
        let shm = format!("{p}-shm");
        let _ = std::fs::remove_file(wal);
        let _ = std::fs::remove_file(shm);
    }
}

fn rename_retry(from: &Path, to: &Path, attempts: u32, base_delay: Duration) -> io::Result<()> {
    let mut i = 0;
    loop {
        match std::fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) => {
                i += 1;
                if i >= attempts {
                    return Err(e);
                }
                // Windows can temporarily lock files/dirs (AV/indexer), so retry with backoff.
                let backoff_ms = base_delay.as_millis() as u64 * i as u64;
                std::thread::sleep(Duration::from_millis(backoff_ms.max(25).min(1500)));
            }
        }
    }
}

fn prepare_empty_dir(path: &Path) -> Result<()> {
    if path.exists() {
        std::fs::remove_dir_all(path)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }
    std::fs::create_dir_all(path)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    Ok(())
}

fn list_attachment_files(dir: &Path) -> Result<Vec<PathBuf>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|_| ErrorCodeString::new("ATTACHMENT_READ"))? {
        let entry = entry.map_err(|_| ErrorCodeString::new("ATTACHMENT_READ"))?;
        let p = entry.path();
        if p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("bin") {
            out.push(p);
        }
    }
    Ok(out)
}

fn attachment_id_from_path(path: &Path) -> Result<String> {
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| ErrorCodeString::new("ATTACHMENT_READ"))?;
    Ok(stem.to_string())
}

fn encrypt_attachments_plain_to_staging(
    profile_id: &str,
    key: &[u8; 32],
    attachments_dir: &Path,
    staging_dir: &Path,
) -> Result<()> {
    prepare_empty_dir(staging_dir)?;
    for file in list_attachment_files(attachments_dir)? {
        let attachment_id = attachment_id_from_path(&file)?;
        let blob = std::fs::read(&file).map_err(|_| ErrorCodeString::new("ATTACHMENT_READ"))?;

        // If we see encrypted magic in a passwordless profile, we can't safely recover it (no old key).
        if blob.starts_with(crate::data::crypto::cipher::PM_ENC_MAGIC) {
            return Err(ErrorCodeString::new("ATTACHMENT_CORRUPTED"));
        }

        let enc = cipher::encrypt_attachment_blob(profile_id, &attachment_id, key, &blob)?;
        let out_path = staging_dir.join(
            file.file_name()
                .ok_or_else(|| ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"))?,
        );
        if write_atomic(&out_path, &enc).is_err() {
            return Err(ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"));
        }
    }
    Ok(())
}

fn reencrypt_attachments_to_staging(
    profile_id: &str,
    old_key: &[u8; 32],
    new_key: &[u8; 32],
    attachments_dir: &Path,
    staging_dir: &Path,
) -> Result<()> {
    prepare_empty_dir(staging_dir)?;
    for file in list_attachment_files(attachments_dir)? {
        let attachment_id = attachment_id_from_path(&file)?;
        let blob = std::fs::read(&file).map_err(|_| ErrorCodeString::new("ATTACHMENT_READ"))?;

        let plain = if blob.starts_with(crate::data::crypto::cipher::PM_ENC_MAGIC) {
            cipher::decrypt_attachment_blob(profile_id, &attachment_id, old_key, &blob)?
        } else {
            // Tolerate plaintext leftovers (legacy/edge cases) and bring them into the new key.
            blob
        };

        let enc = cipher::encrypt_attachment_blob(profile_id, &attachment_id, new_key, &plain)?;
        let out_path = staging_dir.join(
            file.file_name()
                .ok_or_else(|| ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"))?,
        );
        if write_atomic(&out_path, &enc).is_err() {
            return Err(ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"));
        }
    }
    Ok(())
}

pub fn login_vault(id: &str, password: Option<String>, state: &Arc<AppState>) -> Result<bool> {
    let storage_paths = state.get_storage_paths()?;
    let profile = registry::get_profile(&storage_paths, id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;
    let pwd = password.unwrap_or_default();
    let is_passwordless = !profile.has_password;

    if is_passwordless {
        init_database_passwordless(&storage_paths, id)?;
    } else {
        open_protected_vault_session(id, &pwd, &storage_paths, state)?;
    }

    if let Ok(mut active) = state.active_profile.lock() {
        *active = Some(id.to_string());
    }
    Ok(true)
}

pub fn persist_active_vault(state: &Arc<AppState>) -> Result<Option<String>> {
    let _flight_guard = state
        .vault_persist_guard
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    let maybe_bytes_and_meta = {
        let session_guard = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

        if let Some(session) = session_guard.as_ref() {
            let serialized = session
                .conn
                .serialize(DatabaseName::Main)
                .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

            let bytes = Zeroizing::new(serialized.to_vec());

            let profile_id = session.profile_id.clone();
            let key_material = Zeroizing::new(*session.key);

            Some((profile_id, key_material, bytes))
        } else {
            None
        }
    };

    if let Some((profile_id, key_material, bytes)) = maybe_bytes_and_meta {
        let storage_paths = state.get_storage_paths()?;
        let encrypted = cipher::encrypt_vault_blob(&profile_id, &*key_material, bytes.as_slice())?;
        cipher::write_encrypted_file(&vault_db_path(&storage_paths, &profile_id)?, &encrypted)?;
        return Ok(Some(profile_id));
    }

    Ok(None)
}

pub fn request_persist_active_vault(state: Arc<AppState>) {
    state.vault_persist_requested.store(true, Ordering::SeqCst);

    if state.vault_persist_in_flight.swap(true, Ordering::SeqCst) {
        return;
    }

    tauri::async_runtime::spawn_blocking(move || {
        loop {
            state.vault_persist_requested.store(false, Ordering::SeqCst);

            if let Err(error) = persist_active_vault(&state) {
                log::error!("[SECURITY][persist_active_vault] failed: {error:?}");
            }

            if !state.vault_persist_requested.load(Ordering::SeqCst) {
                break;
            }
        }

        state.vault_persist_in_flight.store(false, Ordering::SeqCst);

        if state.vault_persist_requested.load(Ordering::SeqCst) {
            request_persist_active_vault(state);
        }
    });
}

pub fn lock_vault(state: &Arc<AppState>) -> Result<bool> {
    let persisted_id = persist_active_vault(state)?;

    let active_id = {
        let active = state
            .active_profile
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .clone();
        active
    };

    let cleanup_id = persisted_id.clone().or(active_id.clone());

    if let Some(id) = cleanup_id.as_ref() {
        attachments_service::clear_previews_for_profile(state, id)?;
    }

    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        *session = None;
    }

    {
        let mut active = state
            .active_profile
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        *active = None;
    }

    if let Some(id) = cleanup_id.as_ref() {
        clear_pool(id);
    }

    Ok(true)
}

pub fn drop_active_session_without_persist(state: &Arc<AppState>) -> Result<bool> {
    let storage_paths = state.get_storage_paths()?;

    let active_id = state
        .active_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();

    let Some(profile_id) = active_id else {
        return Ok(true);
    };

    attachments_service::clear_previews_for_profile(state, &profile_id)?;

    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        *session = None;
    }

    clear_pool(&profile_id);

    let _ = registry::get_profile(&storage_paths, &profile_id)?;

    Ok(true)
}

pub fn set_profile_password(id: &str, password: &str, state: &Arc<AppState>) -> Result<ProfileMeta> {
    let res = (|| {
        let storage_paths = state.get_storage_paths()?;

        let profile = registry::get_profile(&storage_paths, id)?
            .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

        // registry::get_profile now self-heals has_password based on disk state.
        if profile.has_password {
            return Err(ErrorCodeString::new("PROFILE_ALREADY_PROTECTED"));
        }

        let pwd = password.trim();
        if pwd.is_empty() {
            return Err(ErrorCodeString::new("PASSWORD_REQUIRED"));
        }

        ensure_profile_dirs(&storage_paths, id)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

        // Block any new pooled sqlite connections and wait for checked-out conns to return.
        let _maintenance = MaintenanceGuard::new(id)?;
        drain_and_drop_profile_pools(id, Duration::from_secs(5));
        clear_pool(id);

        let vault_path = vault_db_path(&storage_paths, id)?;
        if !vault_path.exists() {
            return Err(ErrorCodeString::new("VAULT_CORRUPTED"));
        }

        // Snapshot the file DB into memory using SQLite online backup.
        // IMPORTANT: The file DB is WAL-mode (init_database_passwordless sets journal_mode=WAL persistently).
        // Reading/validating a WAL DB can require accessing sidecar files (-wal/-shm). If those cannot be opened,
        // SQLite returns SQLITE_CANTOPEN (14). We avoid that by doing all validation/migrations on the in-memory copy
        // and forcing journal_mode=MEMORY there.
        let (mem_conn, bytes): (rusqlite::Connection, Vec<u8>) = {
            // Open read-only to avoid taking write locks / WAL side-effects during snapshot.
            let src = rusqlite::Connection::open_with_flags(
                &vault_path,
                OpenFlags::SQLITE_OPEN_READ_ONLY,
            )
                .map_err(|e| {
                    log::error!(
                        "[SECURITY][set_profile_password] profile_id={} step=open_src vault={:?} err={}",
                        id,
                        vault_path,
                        format_rusqlite_error(&e)
                    );
                    ErrorCodeString::new("DB_OPEN_FAILED")
                })?;
            src.busy_timeout(Duration::from_secs(15)).map_err(|e| {
                log::error!(
                    "[SECURITY][set_profile_password] profile_id={} step=busy_timeout_src vault={:?} err={}",
                    id,
                    vault_path,
                    format_rusqlite_error(&e)
                );
                ErrorCodeString::new("DB_OPEN_FAILED")
            })?;

            // IMPORTANT:
            // Do NOT run migrations on the file DB here.
            // On Windows/WAL with concurrent connections this can hit SQLITE_BUSY/LOCKED and fail the whole flow.
            // We run migrations on the in-memory snapshot below (mem_conn), which is lock-free.

            let mut mem = rusqlite::Connection::open_in_memory()
                .map_err(|e| {
                    log::error!(
                        "[SECURITY][set_profile_password] profile_id={} step=open_mem err={}",
                        id,
                        format_rusqlite_error(&e)
                    );
                    ErrorCodeString::new("DB_OPEN_FAILED")
                })?;

            apply_in_memory_pragmas(&mem, id, "mem_before_backup")?;

            {
                let backup = Backup::new(&src, &mut mem).map_err(|e| {
                    log::error!(
                        "[SECURITY][set_profile_password] profile_id={} step=backup_init vault={:?} err={}",
                        id,
                        vault_path,
                        format_rusqlite_error(&e)
                    );
                    classify_db_error(&e)
                })?;
                backup
                    .run_to_completion(5, Duration::from_millis(250), None)
                    .map_err(|e| {
                        log::error!(
                            "[SECURITY][set_profile_password] profile_id={} step=backup_run vault={:?} err={}",
                            id,
                            vault_path,
                            format_rusqlite_error(&e)
                        );
                        classify_db_error(&e)
                    })?;
            }

            // Ensure the in-memory copy never tries to use WAL (no -wal/-shm files).
            // This also makes the serialized image safe to deserialize later into :memory:.
            apply_in_memory_pragmas(&mem, id, "mem_after_backup")?;

            migrations::migrate_to_latest(&mem)?;
            migrations::validate_core_schema(&mem)
                .map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;

            // IMPORTANT: `serialize()` returns a value that borrows `mem`.
            // Materialize bytes inside a narrower scope so the borrow ends
            // before we move `mem` out.
            let bytes = {
                let serialized = mem.serialize(DatabaseName::Main).map_err(|e| {
                    log::error!(
                        "[SECURITY][set_profile_password] profile_id={} step=serialize_mem err={}",
                        id,
                        format_rusqlite_error(&e)
                    );
                    classify_db_error(&e)
                })?;
                let mut bytes = serialized.to_vec();
                // Ensure the encrypted vault image is not marked as WAL (prevents unlock-side CANTOPEN).
                normalize_sqlite_header_disable_wal(bytes.as_mut_slice(), id, "set_password_before_encrypt");
                bytes
            };
            (mem, bytes)
        };

        // mem_conn is already validated/migrated in-memory above.

        // Create new salt + key.
        let salt = kdf::generate_kdf_salt();
        let salt_path = kdf_salt_path(&storage_paths, id)?;
        write_atomic(&salt_path, &salt)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

        let key = Zeroizing::new(kdf::derive_master_key(pwd, &salt)?);

        // Create key check file first (so we can validate later).
        key_check::create_key_check_file(&storage_paths, id, &*key)?;

        // Encrypt vault bytes into vault.db (overwriting sqlite file).
        let encrypted = cipher::encrypt_vault_blob(id, &*key, &bytes)?;
        if let Err(e) = cipher::write_encrypted_file(&vault_path, &encrypted) {
            log::error!(
                "[SECURITY][set_profile_password] profile_id={} step=write_encrypted vault={:?} code={}",
                id,
                vault_path,
                e.code
            );
            return Err(e);
        }
        cleanup_sqlite_sidecars(&vault_path);

        // Switch runtime session to protected in-memory session so app stays unlocked.
        // (mem_conn already validated above)

        {
            let mut session = state
                .vault_session
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_LOCK_POISONED"))?;
            *session = Some(VaultSession {
                profile_id: id.to_string(),
                conn: mem_conn,
                key,
            });
        }

        // Update registry flag.
        // IMPORTANT: If the vault has already been encrypted, do not return an error just because
        // registry/config write failed — otherwise UI shows "Failed..." but the profile is actually protected.
        match registry::upsert_profile_with_id(&storage_paths, id, &profile.name, true) {
            Ok(updated) => Ok(updated.into()),
            Err(_) => Ok(ProfileMeta {
                id: profile.id,
                name: profile.name,
                has_password: true,
            }),
        }
    })();

    if let Err(err) = &res {
        log::error!("[SECURITY][set_profile_password] failed: code={}", err.code);
    }
    res
}

pub fn change_profile_password(id: &str, password: &str, state: &Arc<AppState>) -> Result<bool> {
    let storage_paths = state.get_storage_paths()?;

    let profile = registry::get_profile(&storage_paths, id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    if !profile.has_password {
        return Err(ErrorCodeString::new("PROFILE_NOT_PROTECTED"));
    }

    let pwd = password.trim();
    if pwd.is_empty() {
        return Err(ErrorCodeString::new("PASSWORD_REQUIRED"));
    }

    // Prevent concurrent persists while we rotate key material.
    // persist_active_vault takes this guard before reading vault_session.
    let _persist_guard = state
        .vault_persist_guard
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    // Must be unlocked (session exists and matches profile).
    let (mut bytes, old_key) = {
        let session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        let s = session.as_ref().ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;
        if s.profile_id != id {
            return Err(ErrorCodeString::new("VAULT_LOCKED"));
        }
        let serialized = s
            .conn
            .serialize(DatabaseName::Main)
            .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
        let mut bytes = serialized.to_vec();
        normalize_sqlite_header_disable_wal(bytes.as_mut_slice(), id, "change_password_before_encrypt");
        (bytes, Zeroizing::new(*s.key))
    };

    // Stop pools: we will swap files/directories.
    let _maintenance = MaintenanceGuard::new(id)?;
    drain_and_drop_profile_pools(id, Duration::from_secs(5));
    clear_pool(id);

    ensure_profile_dirs(&storage_paths, id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let profile_root = profile_dir(&storage_paths, id)?;
    let backup_root = profile_root.join("tmp").join("change_password_backup");
    if backup_root.exists() {
        let _ = std::fs::remove_dir_all(&backup_root);
    }
    std::fs::create_dir_all(&backup_root)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let vault_path = vault_db_path(&storage_paths, id)?;
    let vault_backup_path = backup_root.join("vault.db.bak");

    let salt_path = kdf_salt_path(&storage_paths, id)?;
    let salt_backup_path = backup_root.join("kdf_salt.bin.bak");

    let key_path = key_check_path(&storage_paths, id)?;
    let key_backup_path = backup_root.join("key_check.bin.bak");

    let attachments_dir = profile_root.join("attachments");
    let attachments_backup_dir = backup_root.join("attachments_old");
    let attachments_staging_dir = backup_root.join("attachments_reencrypted_staging");

    let salt = kdf::generate_kdf_salt();
    let new_key = Zeroizing::new(kdf::derive_master_key(pwd, &salt)?);

    // Stage attachments re-encryption (old_key -> new_key).
    reencrypt_attachments_to_staging(id, &*old_key, &*new_key, &attachments_dir, &attachments_staging_dir)?;

    #[derive(Debug, Clone)]
    struct ChangePasswordRollback {
        vault_path: PathBuf,
        vault_backup_path: PathBuf,
        vault_backed_up: bool,

        salt_path: PathBuf,
        salt_backup_path: PathBuf,
        salt_backed_up: bool,

        key_check_path: PathBuf,
        key_check_backup_path: PathBuf,
        key_check_backed_up: bool,

        attachments_dir: PathBuf,
        attachments_backup_dir: PathBuf,
        attachments_swapped: bool,
    }

    fn rollback_change_profile_password(
        storage_paths: &crate::data::storage_paths::StoragePaths,
        profile_id: &str,
        profile_name: &str,
        rb: &ChangePasswordRollback,
    ) {
        log::warn!(
            "[SECURITY][change_profile_password] rolling back failed operation for profile_id={}",
            profile_id
        );

        if rb.attachments_swapped {
            let _ = std::fs::remove_dir_all(&rb.attachments_dir);
            let _ = std::fs::rename(&rb.attachments_backup_dir, &rb.attachments_dir);
        }

        if rb.vault_backed_up {
            let _ = std::fs::remove_file(&rb.vault_path);
            let _ = std::fs::rename(&rb.vault_backup_path, &rb.vault_path);
        }

        if rb.salt_backed_up {
            let _ = std::fs::remove_file(&rb.salt_path);
            let _ = std::fs::rename(&rb.salt_backup_path, &rb.salt_path);
        }

        if rb.key_check_backed_up {
            let _ = std::fs::remove_file(&rb.key_check_path);
            let _ = std::fs::rename(&rb.key_check_backup_path, &rb.key_check_path);
        }

        let _ = registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, true);
        clear_pool(profile_id);
    }

    let mut rb = ChangePasswordRollback {
        vault_path: vault_path.clone(),
        vault_backup_path: vault_backup_path.clone(),
        vault_backed_up: false,

        salt_path: salt_path.clone(),
        salt_backup_path: salt_backup_path.clone(),
        salt_backed_up: false,

        key_check_path: key_path.clone(),
        key_check_backup_path: key_backup_path.clone(),
        key_check_backed_up: false,

        attachments_dir: attachments_dir.clone(),
        attachments_backup_dir: attachments_backup_dir.clone(),
        attachments_swapped: false,
    };

    // Backup vault/salt/key_check.
    if !vault_path.exists() {
        return Err(ErrorCodeString::new("VAULT_NOT_FOUND"));
    }

    rename_retry(&vault_path, &vault_backup_path, 20, Duration::from_millis(50))
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    rb.vault_backed_up = true;

    if salt_path.exists() {
        rename_retry(&salt_path, &salt_backup_path, 20, Duration::from_millis(50))
            .map_err(|_| {
                rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("PROFILE_STORAGE_WRITE")
            })?;
        rb.salt_backed_up = true;
    }

    if key_path.exists() {
        rename_retry(&key_path, &key_backup_path, 20, Duration::from_millis(50))
            .map_err(|_| {
                rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("PROFILE_STORAGE_WRITE")
            })?;
        rb.key_check_backed_up = true;
    }

    // Write new salt + key_check.
    if write_atomic(&salt_path, &salt).is_err() {
        rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }
    if let Err(e) = key_check::create_key_check_file(&storage_paths, id, &*new_key) {
        rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
        return Err(e);
    }

    // Write new encrypted vault file.
    let encrypted = cipher::encrypt_vault_blob(id, &*new_key, &bytes)?;
    if let Err(e) = cipher::write_encrypted_file(&vault_path, &encrypted) {
        rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
        return Err(e);
    }

    // Swap attachments dir.
    if attachments_backup_dir.exists() {
        let _ = std::fs::remove_dir_all(&attachments_backup_dir);
    }
    rename_retry(&attachments_dir, &attachments_backup_dir, 20, Duration::from_millis(50))
        .map_err(|_| {
            rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("PROFILE_STORAGE_WRITE")
        })?;
    rb.attachments_swapped = true;

    rename_retry(&attachments_staging_dir, &attachments_dir, 20, Duration::from_millis(50))
        .map_err(|_| {
            rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("PROFILE_STORAGE_WRITE")
        })?;

    // Update in-memory session key to keep vault unlocked (only after commit).
    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        let s = session.as_mut().ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;
        if s.profile_id != id {
            rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
            return Err(ErrorCodeString::new("VAULT_LOCKED"));
        }
        s.key = new_key;
    }

    let _ = std::fs::remove_dir_all(&backup_root);
    Ok(true)
}

#[derive(Debug, Clone)]
struct RemovePasswordRollback {
    vault_path: std::path::PathBuf,
    vault_backup_path: std::path::PathBuf,

    salt_path: std::path::PathBuf,
    salt_backup_path: std::path::PathBuf,
    salt_moved: bool,

    key_check_path: std::path::PathBuf,
    key_check_backup_path: std::path::PathBuf,
    key_check_moved: bool,

    attachments_dir: std::path::PathBuf,
    attachments_backup_dir: std::path::PathBuf,
    attachments_swapped: bool,
}

fn rollback_remove_profile_password(
    _state: &Arc<AppState>,
    storage_paths: &crate::data::storage_paths::StoragePaths,
    profile_id: &str,
    profile_name: &str,
    rb: &RemovePasswordRollback,
) {
    log::warn!(
        "[SECURITY][remove_profile_password] rolling back failed operation for profile_id={}",
        profile_id
    );

    if rb.attachments_swapped {
        let _ = std::fs::remove_dir_all(&rb.attachments_dir);
        let _ = std::fs::rename(&rb.attachments_backup_dir, &rb.attachments_dir);
    }

    let _ = std::fs::remove_file(&rb.vault_path);
    let _ = std::fs::rename(&rb.vault_backup_path, &rb.vault_path);

    if rb.salt_moved {
        let _ = std::fs::rename(&rb.salt_backup_path, &rb.salt_path);
    }

    if rb.key_check_moved {
        let _ = std::fs::rename(&rb.key_check_backup_path, &rb.key_check_path);
    }

    let _ = registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, true);
    clear_pool(profile_id);
}

pub fn remove_profile_password(id: &str, state: &Arc<AppState>) -> Result<ProfileMeta> {
    let storage_paths = state.get_storage_paths()?;

    let profile = registry::get_profile(&storage_paths, id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    if !profile.has_password {
        return Err(ErrorCodeString::new("PROFILE_NOT_PROTECTED"));
    }

    // Prevent concurrent persists while we migrate from encrypted/in-memory to passwordless/on-disk.
    let _persist_guard = state
        .vault_persist_guard
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    // Lock session for whole operation.
    let mut session_guard = state
        .vault_session
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
    let session = session_guard
        .as_ref()
        .ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;
    if session.profile_id != id {
        return Err(ErrorCodeString::new("VAULT_LOCKED"));
    }

    ensure_profile_dirs(&storage_paths, id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    // Stop pools: rewriting vault.db and swapping attachments.
    let _maintenance = MaintenanceGuard::new(id)?;
    drain_and_drop_profile_pools(id, Duration::from_secs(5));
    clear_pool(id);

    let profile_root = profile_dir(&storage_paths, id)?;
    let backup_root = profile_root.join("tmp").join("remove_password_backup");
    if backup_root.exists() {
        let _ = std::fs::remove_dir_all(&backup_root);
    }
    std::fs::create_dir_all(&backup_root)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let vault_path = vault_db_path(&storage_paths, id)?;
    let vault_backup_path = backup_root.join("vault.db.bak");

    let salt_path = kdf_salt_path(&storage_paths, id)?;
    let salt_backup_path = backup_root.join("kdf_salt.bin.bak");

    let key_path = key_check_path(&storage_paths, id)?;
    let key_backup_path = backup_root.join("key_check.bin.bak");

    let attachments_dir = profile_root.join("attachments");
    let attachments_backup_dir = backup_root.join("attachments_encrypted");

    let mut rb = RemovePasswordRollback {
        vault_path: vault_path.clone(),
        vault_backup_path: vault_backup_path.clone(),
        salt_path: salt_path.clone(),
        salt_backup_path: salt_backup_path.clone(),
        salt_moved: false,
        key_check_path: key_path.clone(),
        key_check_backup_path: key_backup_path.clone(),
        key_check_moved: false,
        attachments_dir: attachments_dir.clone(),
        attachments_backup_dir: attachments_backup_dir.clone(),
        attachments_swapped: false,
    };

    if !vault_path.exists() {
        return Err(ErrorCodeString::new("VAULT_NOT_FOUND"));
    }
    if rename_retry(&vault_path, &vault_backup_path, 20, Duration::from_millis(50)).is_err() {
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }

    if salt_path.exists() {
        if rename_retry(&salt_path, &salt_backup_path, 20, Duration::from_millis(50)).is_err() {
            let _ = std::fs::rename(&vault_backup_path, &vault_path);
            return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
        }
        rb.salt_moved = true;
    }

    if key_path.exists() {
        if rename_retry(&key_path, &key_backup_path, 20, Duration::from_millis(50)).is_err() {
            let _ = std::fs::rename(&vault_backup_path, &vault_path);
            if rb.salt_moved {
                let _ = std::fs::rename(&salt_backup_path, &salt_path);
            }
            return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
        }
        rb.key_check_moved = true;
    }

    let db_bytes = session
        .conn
        .serialize(DatabaseName::Main)
        .map_err(|_| {
            rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("DB_QUERY_FAILED")
        })?;

    let key = Zeroizing::new(*session.key);

    if write_atomic(&vault_path, &db_bytes[..]).is_err() {
        rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }

    // Ensure WAL (persistent) like init_database_passwordless.
    {
        let conn = Connection::open(&vault_path).map_err(|_| {
            rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("DB_OPEN_FAILED")
        })?;

        let current: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .map_err(|_| {
                rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("DB_QUERY_FAILED")
            })?;

        if current.to_uppercase() != "WAL" {
            let _: String = conn
                .query_row("PRAGMA journal_mode=WAL;", [], |row| row.get(0))
                .map_err(|_| {
                    rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
                    ErrorCodeString::new("DB_QUERY_FAILED")
                })?;
        }
    }

    // Attachments migration to plaintext.
    let staging_dir = backup_root.join("attachments_plain_staging");
    if staging_dir.exists() {
        let _ = std::fs::remove_dir_all(&staging_dir);
    }
    if std::fs::create_dir_all(&staging_dir).is_err() {
        rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }

    if let Ok(entries) = std::fs::read_dir(&attachments_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let file_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n,
                None => continue,
            };

            if !file_name.ends_with(".bin") {
                continue;
            }

            let attachment_id = file_name.trim_end_matches(".bin");
            let blob = std::fs::read(&path).map_err(|_| {
                rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("ATTACHMENT_READ")
            })?;

            let plaintext = if blob.starts_with(&cipher::PM_ENC_MAGIC) {
                cipher::decrypt_attachment_blob(id, attachment_id, &*key, &blob).map_err(|e| {
                    rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
                    e
                })?
            } else {
                blob
            };

            let out_path = staging_dir.join(file_name);
            if write_atomic(&out_path, &plaintext).is_err() {
                rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
                return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
            }
        }
    }

    if attachments_backup_dir.exists() {
        let _ = std::fs::remove_dir_all(&attachments_backup_dir);
    }
    if rename_retry(&attachments_dir, &attachments_backup_dir, 20, Duration::from_millis(50)).is_err() {
        rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }
    rb.attachments_swapped = true;

    if rename_retry(&staging_dir, &attachments_dir, 20, Duration::from_millis(50)).is_err() {
        rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }

    let updated = match registry::upsert_profile_with_id(&storage_paths, id, &profile.name, false) {
        Ok(u) => u,
        Err(err) => {
            rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
            return Err(err);
        }
    };

    *session_guard = None;
    clear_pool(id);

    let _ = std::fs::remove_dir_all(&backup_root);
    Ok(updated.into())
}

pub fn is_logged_in(state: &Arc<AppState>) -> Result<bool> {
    let storage_paths = state.get_storage_paths()?;

    let active_id = state
        .active_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();

    let Some(id) = active_id else {
        return Ok(false);
    };

    let profile = crate::data::profiles::registry::get_profile(&storage_paths, &id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    if !profile.has_password {
        return Ok(true);
    }

    let session = state
        .vault_session
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    Ok(session
        .as_ref()
        .map(|s| s.profile_id == id)
        .unwrap_or(false))
}

pub struct ActiveSessionInfo {
    pub profile_id: String,
    pub vault_key: Option<[u8; 32]>,
}

pub fn require_unlocked_active_profile(state: &Arc<AppState>) -> Result<ActiveSessionInfo> {
    let storage_paths = state.get_storage_paths()?;

    let active_id = state
        .active_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone()
        .ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;

    let profile = crate::data::profiles::registry::get_profile(&storage_paths, &active_id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    if !profile.has_password {
        return Ok(ActiveSessionInfo {
            profile_id: active_id,
            vault_key: None,
        });
    }

    let session = state
        .vault_session
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    if let Some(s) = session.as_ref() {
        if s.profile_id == active_id {
            return Ok(ActiveSessionInfo {
                profile_id: active_id,
                vault_key: Some(*s.key),
            });
        }
    }

    Err(ErrorCodeString::new("VAULT_LOCKED"))
}

pub fn auto_lock_cleanup(state: &Arc<AppState>) -> Result<bool> {
    if let Some(id) = persist_active_vault(state)? {
        attachments_service::clear_previews_for_profile(state, &id)?;
    }
    is_logged_in(state)
}

pub fn health_check() -> Result<bool> {
    Ok(true)
}
