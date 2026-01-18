use std::io::{self, Read};
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

fn best_effort_force_journal_mode_memory(conn: &rusqlite::Connection, profile_id: &str, ctx: &str) {
    // Best-effort: we do not fail the whole flow if this pragma fails.
    // The goal is to ensure serialized in-memory images are not WAL-marked.
    let res: rusqlite::Result<String> = conn.query_row("PRAGMA journal_mode=MEMORY;", [], |row| row.get(0));
    if let Err(e) = res {
        log::warn!(
            "[SECURITY][pragmas] profile_id={} ctx={} action=journal_mode_memory_failed err={}",
            profile_id,
            ctx,
            format_rusqlite_error(&e)
        );
    }
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
        log::info!(
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

    best_effort_force_journal_mode_memory(&conn, profile_id, "unlock_after_deserialize");

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

fn is_dir_nonempty(dir: &Path) -> io::Result<bool> {
    if !dir.exists() {
        return Ok(false);
    }
    let mut it = std::fs::read_dir(dir)?;
    Ok(it.next().is_some())
}

fn read_file_prefix(path: &Path, len: usize) -> io::Result<Vec<u8>> {
    let mut f = std::fs::File::open(path)?;
    let mut buf = vec![0u8; len];
    let mut read = 0usize;
    while read < len {
        let n = f.read(&mut buf[read..])?;
        if n == 0 {
            break;
        }
        read += n;
    }
    buf.truncate(read);
    Ok(buf)
}

fn file_has_prefix(path: &Path, prefix: &[u8]) -> bool {
    match read_file_prefix(path, prefix.len()) {
        Ok(buf) => buf.as_slice() == prefix,
        Err(_) => false,
    }
}

fn dir_contains_encrypted_attachments(dir: &Path) -> io::Result<bool> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
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
        if file_has_prefix(&path, &cipher::PM_ENC_MAGIC) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn file_has_sqlite_magic(path: &Path) -> bool {
    const MAGIC: &[u8; 16] = b"SQLite format 3\0";
    file_has_prefix(path, MAGIC)
}

fn prepare_transition_backup_root(
    backup_root: &Path,
    storage_paths: &crate::data::storage_paths::StoragePaths,
    profile_id: &str,
    profile_name: &str,
) -> Result<()> {
    if backup_root.exists() {
        // If it contains data, treat it as an incomplete prior transaction and recover first.
        if is_dir_nonempty(backup_root).unwrap_or(false) {
            recover_incomplete_profile_transitions(storage_paths, profile_id, profile_name)?;
        }
        let _ = std::fs::remove_dir_all(backup_root);
    }

    std::fs::create_dir_all(backup_root).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

const REMOVE_PASSWORD_COMMIT_MARKER: &str = "remove_password.commit";

fn write_remove_password_commit_marker(backup_root: &Path) -> Result<()> {
    let marker_path = backup_root.join(REMOVE_PASSWORD_COMMIT_MARKER);
    write_atomic(&marker_path, b"1").map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

const SET_PASSWORD_COMMIT_MARKER: &str = "set_password.commit";
const CHANGE_PASSWORD_COMMIT_MARKER: &str = "change_password.commit";

fn write_set_password_commit_marker(backup_root: &Path) -> Result<()> {
    let marker_path = backup_root.join(SET_PASSWORD_COMMIT_MARKER);
    write_atomic(&marker_path, b"1").map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

fn write_change_password_commit_marker(backup_root: &Path) -> Result<()> {
    let marker_path = backup_root.join(CHANGE_PASSWORD_COMMIT_MARKER);
    write_atomic(&marker_path, b"1").map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

fn recover_set_password_transition(
    storage_paths: &crate::data::storage_paths::StoragePaths,
    profile_id: &str,
    profile_name: &str,
    backup_root: &Path,
) -> Result<()> {
    if !is_dir_nonempty(backup_root).unwrap_or(false) {
        return Ok(());
    }

    // Commit marker makes crash-recovery deterministic: either we complete the transition
    // (marker present) or we rollback to the old password (marker absent).
    let commit_marker_path = backup_root.join(CHANGE_PASSWORD_COMMIT_MARKER);
    let commit_ready = commit_marker_path.exists();

    let profile_root = profile_dir(storage_paths, profile_id)?;
    let vault_path = vault_db_path(storage_paths, profile_id)?;
    let vault_backup_path = backup_root.join("vault.db.bak");

    let salt_path = kdf_salt_path(storage_paths, profile_id)?;
    let salt_backup_path = backup_root.join("kdf_salt.bin.bak");
    let salt_new_path = backup_root.join("kdf_salt.bin.new");

    let key_path = key_check_path(storage_paths, profile_id)?;
    let key_backup_path = backup_root.join("key_check.bin.bak");
    let key_new_path = backup_root.join("key_check.bin.new");

    let attachments_dir = profile_root.join("attachments");
    let attachments_plain_backup_dir = backup_root.join("attachments_plain");
    let attachments_staging_dir = backup_root.join("attachments_encrypted_staging");

    let vault_is_encrypted = vault_path.exists() && file_has_prefix(&vault_path, &cipher::PM_ENC_MAGIC);
    let has_salt = salt_path.exists();
    let has_key = key_path.exists();
    let salt_ready = has_salt || salt_new_path.exists();
    let key_ready = has_key || key_new_path.exists();


    if commit_ready && !(vault_is_encrypted && salt_ready && key_ready) {
        log::error!(
            "[SECURITY][recover_set_password_transition] profile_id={} action=commit_marker_but_materials_incomplete vault_encrypted={} salt_ready={} key_ready={}",
            profile_id,
            vault_is_encrypted,
            salt_ready,
            key_ready
        );
    }

    // Deterministic crash-recovery: if commit marker exists, finish the protected transition.
    // Otherwise we rollback to passwordless.
    if commit_ready {
        if attachments_staging_dir.exists() {
            // Complete attachments swap if needed.
            if attachments_dir.exists() {
                if attachments_plain_backup_dir.exists() {
                    std::fs::remove_dir_all(&attachments_plain_backup_dir)
                        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                }
                rename_retry(
                    &attachments_dir,
                    &attachments_plain_backup_dir,
                    20,
                    Duration::from_millis(50),
                )
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
            }

            if attachments_dir.exists() {
                std::fs::remove_dir_all(&attachments_dir)
                    .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
            }

            if let Err(e) = rename_retry(
                &attachments_staging_dir,
                &attachments_dir,
                20,
                Duration::from_millis(50),
            ) {
                // Best-effort rollback: restore original attachments dir if we moved it.
                if attachments_plain_backup_dir.exists() && !attachments_dir.exists() {
                    let _ = rename_retry(
                        &attachments_plain_backup_dir,
                        &attachments_dir,
                        20,
                        Duration::from_millis(50),
                    );
                }
                log::warn!(
                    "[SECURITY][recover_set_password_transition] profile_id={} action=attachments_swap_failed err={}",
                    profile_id,
                    e
                );
                return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
            }
        }

        // Commit staged key material if it was prepared but not moved into place.
        if !has_salt && salt_new_path.exists() {
            replace_file_retry(
                &salt_new_path,
                &salt_path,
                20,
                Duration::from_millis(50),
            )
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        if !has_key && key_new_path.exists() {
            replace_file_retry(
                &key_new_path,
                &key_path,
                20,
                Duration::from_millis(50),
            )
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }

        registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, true)?;
        clear_pool(profile_id);
        let _ = std::fs::remove_dir_all(backup_root);
        return Ok(());
    }

    // Otherwise, rollback to passwordless.
    let _ = std::fs::remove_file(&commit_marker_path);
    if vault_backup_path.exists() {
        if vault_path.exists() {
            std::fs::remove_file(&vault_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&vault_backup_path, &vault_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    } else if vault_path.exists() {
        // If we don't have a vault backup, we must not delete the current vault file.
        // This situation can happen if the password-setting flow failed *before* backing up the vault
        // (e.g. rename failed due to a transient file lock), or if the primary flow already rolled back
        // successfully but left backup_root non-empty. In both cases, deleting vault.db would cause
        // irreversible data loss.
        log::warn!(
            "[SECURITY][recover_set_password_transition] profile_id={} action=skip_vault_rollback reason=no_vault_backup vault={:?}",
            profile_id,
            vault_path
        );
    }

    if salt_backup_path.exists() {
        if salt_path.exists() {
            std::fs::remove_file(&salt_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&salt_backup_path, &salt_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    } else if salt_path.exists() {
        let _ = std::fs::remove_file(&salt_path);
    }

    if salt_new_path.exists() {
        let _ = std::fs::remove_file(&salt_new_path);
    }

    if key_backup_path.exists() {
        if key_path.exists() {
            std::fs::remove_file(&key_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&key_backup_path, &key_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    } else if key_path.exists() {
        let _ = std::fs::remove_file(&key_path);
    }

    if key_new_path.exists() {
        let _ = std::fs::remove_file(&key_new_path);
    }

    if attachments_plain_backup_dir.exists() {
        if attachments_dir.exists() {
            std::fs::remove_dir_all(&attachments_dir)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(
            &attachments_plain_backup_dir,
            &attachments_dir,
            20,
            Duration::from_millis(50),
        )
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    // Ensure staging dir does not survive a rollback.
    if attachments_staging_dir.exists() {
        std::fs::remove_dir_all(&attachments_staging_dir)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, false)?;
    clear_pool(profile_id);
    let _ = std::fs::remove_dir_all(backup_root);
    Ok(())
}



fn recover_change_password_transition(
    storage_paths: &crate::data::storage_paths::StoragePaths,
    profile_id: &str,
    profile_name: &str,
    backup_root: &Path,
) -> Result<()> {
    if !is_dir_nonempty(backup_root).unwrap_or(false) {
        return Ok(());
    }

    // Commit marker makes crash-recovery deterministic: either we complete the transition
    // (marker present) or we rollback to old password (marker absent).
    let commit_marker_path = backup_root.join(CHANGE_PASSWORD_COMMIT_MARKER);
    let commit_ready = commit_marker_path.exists();

    let profile_root = profile_dir(storage_paths, profile_id)?;
    let vault_path = vault_db_path(storage_paths, profile_id)?;
    let vault_backup_path = backup_root.join("vault.db.bak");

    let salt_path = kdf_salt_path(storage_paths, profile_id)?;
    let salt_backup_path = backup_root.join("kdf_salt.bin.bak");
    let salt_new_path = backup_root.join("kdf_salt.bin.new");

    let key_path = key_check_path(storage_paths, profile_id)?;
    let key_backup_path = backup_root.join("key_check.bin.bak");
    let key_new_path = backup_root.join("key_check.bin.new");

    let attachments_dir = profile_root.join("attachments");
    let attachments_backup_dir = backup_root.join("attachments_old");
    let attachments_staging_dir = backup_root.join("attachments_reencrypted_staging");

    let vault_ok = vault_path.exists() && file_has_prefix(&vault_path, &cipher::PM_ENC_MAGIC);
    let salt_ok = salt_path.exists();
    let key_ok = key_path.exists();
    let salt_ready = salt_ok || salt_new_path.exists();
    let key_ready = key_ok || key_new_path.exists();


    if commit_ready && !(vault_ok && salt_ready && key_ready) {
        log::error!(
            "[SECURITY][recover_change_password_transition] profile_id={} action=commit_marker_but_materials_incomplete vault_ok={} salt_ready={} key_ready={}",
            profile_id,
            vault_ok,
            salt_ready,
            key_ready
        );
    }

    // Deterministic crash-recovery: only finish the transition if we have evidence of the
    // vault rotation starting (commit marker or vault backup) and all key material is ready.
    if vault_ok && salt_ready && key_ready && (commit_ready || vault_backup_path.exists()) {
        if attachments_staging_dir.exists() {
            // Complete attachments swap if needed.
            if attachments_dir.exists() {
                if !attachments_backup_dir.exists() {
                    rename_retry(
                        &attachments_dir,
                        &attachments_backup_dir,
                        20,
                        Duration::from_millis(50),
                    )
                    .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                } else {
                    // Backup already exists; clear current dir to make room for staging swap.
                    std::fs::remove_dir_all(&attachments_dir)
                        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                }
            }

            if attachments_dir.exists() {
                std::fs::remove_dir_all(&attachments_dir)
                    .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
            }

            if let Err(e) = rename_retry(
                &attachments_staging_dir,
                &attachments_dir,
                20,
                Duration::from_millis(50),
            ) {
                // Best-effort rollback: restore original attachments dir if we moved it.
                if attachments_backup_dir.exists() && !attachments_dir.exists() {
                    let _ = rename_retry(
                        &attachments_backup_dir,
                        &attachments_dir,
                        20,
                        Duration::from_millis(50),
                    );
                }
                log::warn!(
                    "[SECURITY][recover_change_password_transition] profile_id={} action=attachments_swap_failed err={}",
                    profile_id,
                    e
                );
                return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
            }
        }

        // Commit staged key material if it was prepared but not moved into place.
        if !salt_ok && salt_new_path.exists() {
            replace_file_retry(
                &salt_new_path,
                &salt_path,
                20,
                Duration::from_millis(50),
            )
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        if !key_ok && key_new_path.exists() {
            replace_file_retry(
                &key_new_path,
                &key_path,
                20,
                Duration::from_millis(50),
            )
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }

        registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, true)?;
        clear_pool(profile_id);
        let _ = std::fs::remove_dir_all(backup_root);
        return Ok(());
    }

    // Rollback to old password (restore backups).
    let _ = std::fs::remove_file(&commit_marker_path);
    if vault_backup_path.exists() {
        if vault_path.exists() {
            std::fs::remove_file(&vault_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&vault_backup_path, &vault_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    if salt_backup_path.exists() {
        if salt_path.exists() {
            std::fs::remove_file(&salt_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&salt_backup_path, &salt_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    if salt_new_path.exists() {
        let _ = std::fs::remove_file(&salt_new_path);
    }

    if key_backup_path.exists() {
        if key_path.exists() {
            std::fs::remove_file(&key_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&key_backup_path, &key_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    if key_new_path.exists() {
        let _ = std::fs::remove_file(&key_new_path);
    }

    if attachments_backup_dir.exists() {
        if attachments_dir.exists() {
            std::fs::remove_dir_all(&attachments_dir)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(
            &attachments_backup_dir,
            &attachments_dir,
            20,
            Duration::from_millis(50),
        )
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    // Remove any staging dir left from a partially completed swap.
    if attachments_staging_dir.exists() {
        std::fs::remove_dir_all(&attachments_staging_dir)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    // After rollback, the profile is still protected.
    registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, true)?;
    clear_pool(profile_id);
    let _ = std::fs::remove_dir_all(backup_root);
    Ok(())
}



fn recover_remove_password_transition(
    storage_paths: &crate::data::storage_paths::StoragePaths,
    profile_id: &str,
    profile_name: &str,
    backup_root: &Path,
) -> Result<()> {
    if !is_dir_nonempty(backup_root).unwrap_or(false) {
        return Ok(());
    }

    // Commit marker makes crash-recovery deterministic: either we complete the transition
    // (marker present) or we rollback to protected (marker absent).
    let commit_marker_path = backup_root.join(REMOVE_PASSWORD_COMMIT_MARKER);
    let commit_ready = commit_marker_path.exists();

    let profile_root = profile_dir(storage_paths, profile_id)?;
    let vault_path = vault_db_path(storage_paths, profile_id)?;
    let vault_backup_path = backup_root.join("vault.db.bak");

    let salt_path = kdf_salt_path(storage_paths, profile_id)?;
    let salt_backup_path = backup_root.join("kdf_salt.bin.bak");

    let key_path = key_check_path(storage_paths, profile_id)?;
    let key_backup_path = backup_root.join("key_check.bin.bak");

    let attachments_dir = profile_root.join("attachments");
    let attachments_encrypted_backup_dir = backup_root.join("attachments_encrypted");
    let attachments_plain_staging_dir = backup_root.join("attachments_plain_staging");

    let vault_is_plain = vault_path.exists() && file_has_sqlite_magic(&vault_path);

    // Deterministic crash-recovery:
    // - If commit marker exists, we must finish the passwordless transition.
    // - Otherwise, we rollback to the protected state.
    if commit_ready {
        if !vault_is_plain {
            log::error!(
                "[SECURITY][recover_remove_password_transition] profile_id={} action=commit_marker_but_vault_not_plain",
                profile_id
            );
        } else {
            // Ensure attachments are plaintext (they should already be swapped before marker is written).
            // If there is leftover staging dir, attempt to complete the swap.
            if attachments_plain_staging_dir.exists() {
                if attachments_dir.exists() {
                    if attachments_encrypted_backup_dir.exists() {
                        std::fs::remove_dir_all(&attachments_encrypted_backup_dir)
                            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                    }
                    rename_retry(
                        &attachments_dir,
                        &attachments_encrypted_backup_dir,
                        20,
                        Duration::from_millis(50),
                    )
                    .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                }

                if attachments_dir.exists() {
                    std::fs::remove_dir_all(&attachments_dir)
                        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                }

                if let Err(e) = rename_retry(
                    &attachments_plain_staging_dir,
                    &attachments_dir,
                    20,
                    Duration::from_millis(50),
                ) {
                    // Best-effort rollback: restore encrypted attachments dir if we moved it.
                    if attachments_encrypted_backup_dir.exists() && !attachments_dir.exists() {
                        let _ = rename_retry(
                            &attachments_encrypted_backup_dir,
                            &attachments_dir,
                            20,
                            Duration::from_millis(50),
                        );
                    }
                    log::warn!(
                        "[SECURITY][recover_remove_password_transition] profile_id={} action=attachments_swap_failed err={}",
                        profile_id,
                        e
                    );
                    return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
                }
            }

            // If attachments dir exists, ensure no encrypted blobs remain.
            // If encrypted blobs remain even though the commit marker exists, we cannot
            // safely finish the transition (we would lose the key material). In that case,
            // fall through to rollback-to-protected below.
            let mut attachments_ok = true;
            if attachments_dir.exists() {
                let contains_enc = dir_contains_encrypted_attachments(&attachments_dir)
                    .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                if contains_enc {
                    attachments_ok = false;
                    log::error!(
                        "[SECURITY][recover_remove_password_transition] profile_id={} action=commit_marker_but_attachments_encrypted",
                        profile_id
                    );
                }
            }

            if attachments_ok {
                // Remove key material last (move into backup then drop backup_root).
                if salt_path.exists() {
                    if salt_backup_path.exists() {
                        remove_file_retry(&salt_backup_path, 20, Duration::from_millis(50))
                            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                    }
                    rename_retry(&salt_path, &salt_backup_path, 20, Duration::from_millis(50))
                        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                }

                if key_path.exists() {
                    if key_backup_path.exists() {
                        remove_file_retry(&key_backup_path, 20, Duration::from_millis(50))
                            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                    }
                    rename_retry(&key_path, &key_backup_path, 20, Duration::from_millis(50))
                        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
                }

                registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, false)?;
                clear_pool(profile_id);
                let _ = std::fs::remove_dir_all(backup_root);
                return Ok(());
            }
        }
        // If the marker is present but we can't safely finish, rollback to protected below.
    }

    // Otherwise, rollback back to protected.
    if vault_backup_path.exists() {
        if vault_path.exists() {
            std::fs::remove_file(&vault_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&vault_backup_path, &vault_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    if salt_backup_path.exists() {
        if salt_path.exists() {
            std::fs::remove_file(&salt_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&salt_backup_path, &salt_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    if key_backup_path.exists() {
        if key_path.exists() {
            std::fs::remove_file(&key_path)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(&key_backup_path, &key_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    if attachments_encrypted_backup_dir.exists() {
        if attachments_dir.exists() {
            std::fs::remove_dir_all(&attachments_dir)
                .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        }
        rename_retry(
            &attachments_encrypted_backup_dir,
            &attachments_dir,
            20,
            Duration::from_millis(50),
        )
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    // Remove any leftover plain staging dir.
    if attachments_plain_staging_dir.exists() {
        std::fs::remove_dir_all(&attachments_plain_staging_dir)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }

    registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, true)?;
    clear_pool(profile_id);
    let _ = std::fs::remove_dir_all(backup_root);
    Ok(())
}



fn recover_incomplete_profile_transitions(
    storage_paths: &crate::data::storage_paths::StoragePaths,
    profile_id: &str,
    profile_name: &str,
) -> Result<()> {
    let profile_root = profile_dir(storage_paths, profile_id)?;
    let tmp_root = profile_root.join("tmp");

    let set_root = tmp_root.join("set_password_backup");
    if set_root.exists() {
        recover_set_password_transition(storage_paths, profile_id, profile_name, &set_root)?;
    }

    let change_root = tmp_root.join("change_password_backup");
    if change_root.exists() {
        recover_change_password_transition(storage_paths, profile_id, profile_name, &change_root)?;
    }

    let remove_root = tmp_root.join("remove_password_backup");
    if remove_root.exists() {
        recover_remove_password_transition(storage_paths, profile_id, profile_name, &remove_root)?;
    }

    Ok(())
}



#[cfg(unix)]
fn best_effort_fsync_dir(dir: &Path) {
    if let Ok(f) = std::fs::File::open(dir) {
        let _ = f.sync_all();
    }
}

fn best_effort_fsync_parent_dir(path: &Path) {
    #[cfg(unix)]
    {
        if let Some(parent) = path.parent() {
            best_effort_fsync_dir(parent);
        }
    }
}

fn best_effort_fsync_rename_dirs(from: &Path, to: &Path) {
    #[cfg(unix)]
    {
        if let Some(p) = from.parent() {
            best_effort_fsync_dir(p);
        }
        let from_parent = from.parent();
        let to_parent = to.parent();
        if to_parent.is_some() && to_parent != from_parent {
            best_effort_fsync_dir(to_parent.unwrap());
        }
    }
}

fn rename_retry(from: &Path, to: &Path, attempts: u32, base_delay: Duration) -> io::Result<()> {
    let mut i = 0;
    loop {
        match std::fs::rename(from, to) {
            Ok(()) => {
                best_effort_fsync_rename_dirs(from, to);
                return Ok(());
            }
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

fn remove_file_retry(path: &Path, attempts: u32, base_delay: Duration) -> io::Result<()> {
    let mut i = 0;
    loop {
        match std::fs::remove_file(path) {
            Ok(()) => {
                best_effort_fsync_parent_dir(path);
                return Ok(());
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
            Err(e) => {
                i += 1;
                if i >= attempts {
                    return Err(e);
                }
                let backoff_ms = base_delay.as_millis() as u64 * i as u64;
                std::thread::sleep(Duration::from_millis(backoff_ms.max(25).min(1500)));
            }
        }
    }
}

fn replace_file_retry(from: &Path, to: &Path, attempts: u32, base_delay: Duration) -> io::Result<()> {
    if to.exists() {
        remove_file_retry(to, attempts, base_delay)?;
    }
    rename_retry(from, to, attempts, base_delay)
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
        if blob.starts_with(&cipher::PM_ENC_MAGIC) {
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

        let plain = if blob.starts_with(&cipher::PM_ENC_MAGIC) {
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
    let mut profile = registry::get_profile(&storage_paths, id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    // If a previous set/change/remove password operation crashed mid-flight,
    // recover the on-disk profile state before attempting to open the vault.
    recover_incomplete_profile_transitions(&storage_paths, id, &profile.name)?;
    profile = registry::get_profile(&storage_paths, id)?
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

        let pwd = password;
        if pwd.chars().all(|c| c.is_whitespace()) {
            return Err(ErrorCodeString::new("PASSWORD_REQUIRED"));
        }

        ensure_profile_dirs(&storage_paths, id)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

        // Block any new pooled sqlite connections and wait for checked-out conns to return.
        let _maintenance = MaintenanceGuard::new(id)?;
        drain_and_drop_profile_pools(id, Duration::from_secs(5));
        clear_pool(id);

        recover_incomplete_profile_transitions(&storage_paths, id, &profile.name)?;

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
                best_effort_force_journal_mode_memory(&mem, id, "set_password_before_serialize");
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

        // Prepare transactional backup root for multi-file commit (vault.db + salt + key_check + attachments).
        // This prevents leaving the profile in a half-protected state (e.g. vault encrypted but attachments still plaintext).
        let profile_root = profile_dir(&storage_paths, id)?;
        let backup_root = profile_root.join("tmp").join("set_password_backup");
        prepare_transition_backup_root(&backup_root, &storage_paths, id, &profile.name)?;

        let vault_backup_path = backup_root.join("vault.db.bak");

        let salt_path = kdf_salt_path(&storage_paths, id)?;
        let salt_backup_path = backup_root.join("kdf_salt.bin.bak");
        let salt_new_path = backup_root.join("kdf_salt.bin.new");

        let key_path = key_check_path(&storage_paths, id)?;
        let key_backup_path = backup_root.join("key_check.bin.bak");
        let key_new_path = backup_root.join("key_check.bin.new");

        let attachments_dir = profile_root.join("attachments");
        let attachments_backup_dir = backup_root.join("attachments_plain");
        let attachments_staging_dir = backup_root.join("attachments_encrypted_staging");

        // Create new salt + key (but don't persist until vault/attachments are ready).
        let salt = kdf::generate_kdf_salt();
        let key = Zeroizing::new(kdf::derive_master_key(pwd, &salt)?);

        // Stage encrypted attachments for protected mode.
        // If any attachment already looks encrypted (PMENC magic), abort: we can't safely recover it without an old key.
        encrypt_attachments_plain_to_staging(id, &*key, &attachments_dir, &attachments_staging_dir)?;

        #[derive(Debug, Clone)]
        struct SetPasswordRollback {
            vault_path: PathBuf,
            vault_backup_path: PathBuf,
            vault_backed_up: bool,

            salt_path: PathBuf,
            salt_backup_path: PathBuf,
            salt_new_path: PathBuf,
            salt_present_before: bool,
            salt_backed_up: bool,

            key_check_path: PathBuf,
            key_check_backup_path: PathBuf,
            key_check_new_path: PathBuf,
            key_check_present_before: bool,
            key_check_backed_up: bool,

            attachments_dir: PathBuf,
            attachments_backup_dir: PathBuf,
            attachments_swapped: bool,
        }

        fn rollback_set_profile_password(
            storage_paths: &crate::data::storage_paths::StoragePaths,
            profile_id: &str,
            profile_name: &str,
            rb: &SetPasswordRollback,
        ) {
            log::warn!(
                "[SECURITY][set_profile_password] rolling back failed operation for profile_id={}",
                profile_id
            );

            let _ = std::fs::remove_file(&rb.salt_new_path);
            let _ = std::fs::remove_file(&rb.key_check_new_path);

            if rb.attachments_swapped {
                let _ = std::fs::remove_dir_all(&rb.attachments_dir);
                let _ = rename_retry(&rb.attachments_backup_dir, &rb.attachments_dir, 20, Duration::from_millis(50));
            }

            if rb.key_check_backed_up {
                let _ = std::fs::remove_file(&rb.key_check_path);
                let _ = rename_retry(&rb.key_check_backup_path, &rb.key_check_path, 20, Duration::from_millis(50));
            } else if !rb.key_check_present_before {
                let _ = std::fs::remove_file(&rb.key_check_path);
            }

            if rb.salt_backed_up {
                let _ = std::fs::remove_file(&rb.salt_path);
                let _ = rename_retry(&rb.salt_backup_path, &rb.salt_path, 20, Duration::from_millis(50));
            } else if !rb.salt_present_before {
                let _ = std::fs::remove_file(&rb.salt_path);
            }

            if rb.vault_backed_up {
                let _ = std::fs::remove_file(&rb.vault_path);
                let _ = rename_retry(&rb.vault_backup_path, &rb.vault_path, 20, Duration::from_millis(50));
            }

            let _ = registry::upsert_profile_with_id(storage_paths, profile_id, profile_name, false);
            clear_pool(profile_id);
        }

        let mut rb = SetPasswordRollback {
            vault_path: vault_path.clone(),
            vault_backup_path: vault_backup_path.clone(),
            vault_backed_up: false,

            salt_path: salt_path.clone(),
            salt_backup_path: salt_backup_path.clone(),
            salt_new_path: salt_new_path.clone(),
            salt_present_before: salt_path.exists(),
            salt_backed_up: false,

            key_check_path: key_path.clone(),
            key_check_backup_path: key_backup_path.clone(),
            key_check_new_path: key_new_path.clone(),
            key_check_present_before: key_path.exists(),
            key_check_backed_up: false,

            attachments_dir: attachments_dir.clone(),
            attachments_backup_dir: attachments_backup_dir.clone(),
            attachments_swapped: false,
        };

        // Backup current vault + any stray salt/key_check left by a previous failed operation.
        if !vault_path.exists() {
            return Err(ErrorCodeString::new("VAULT_NOT_FOUND"));
        }

        rename_retry(&vault_path, &vault_backup_path, 20, Duration::from_millis(50))
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        rb.vault_backed_up = true;

        if salt_path.exists() {
            rename_retry(&salt_path, &salt_backup_path, 20, Duration::from_millis(50))
                .map_err(|_| {
                    rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
                    ErrorCodeString::new("PROFILE_STORAGE_WRITE")
                })?;
            rb.salt_backed_up = true;
        }

        if key_path.exists() {
            rename_retry(&key_path, &key_backup_path, 20, Duration::from_millis(50))
                .map_err(|_| {
                    rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
                    ErrorCodeString::new("PROFILE_STORAGE_WRITE")
                })?;
            rb.key_check_backed_up = true;
        }

        // Write encrypted vault file to vault.db (replacing sqlite file).
        let encrypted = cipher::encrypt_vault_blob(id, &*key, &bytes)?;
        if let Err(e) = cipher::write_encrypted_file(&vault_path, &encrypted) {
            rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
            return Err(e);
        }

        // Swap attachments dir to encrypted form.
        if attachments_backup_dir.exists() {
            let _ = std::fs::remove_dir_all(&attachments_backup_dir);
        }
        rename_retry(&attachments_dir, &attachments_backup_dir, 20, Duration::from_millis(50))
            .map_err(|_| {
                rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("PROFILE_STORAGE_WRITE")
            })?;
        rb.attachments_swapped = true;

        rename_retry(&attachments_staging_dir, &attachments_dir, 20, Duration::from_millis(50))
            .map_err(|_| {
                rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("PROFILE_STORAGE_WRITE")
            })?;

        // Two-phase commit for key material:
        // 1) write to *.new under backup_root
        // 2) atomically move into place after vault+attachments are committed
        if write_atomic(&salt_new_path, &salt).is_err() {
            rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
            return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
        }
        let key_blob = key_check::create_key_check_blob(id, &*key)?;
        if let Err(e) = key_check::write_key_check_blob(&key_new_path, &key_blob) {
            rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
            return Err(e);
        }
        replace_file_retry(&salt_new_path, &salt_path, 20, Duration::from_millis(50))
            .map_err(|_| {
                rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("PROFILE_STORAGE_WRITE")
            })?;
        replace_file_retry(&key_new_path, &key_path, 20, Duration::from_millis(50))
            .map_err(|_| {
                rollback_set_profile_password(&storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("PROFILE_STORAGE_WRITE")
            })?;


        // Disk commit point reached (vault + attachments + key material).
        // Write a commit marker so crash-recovery is deterministic.
        if let Err(err) = write_set_password_commit_marker(&backup_root) {
            log::warn!(
                "[SECURITY][set_profile_password] profile_id={} step=write_commit_marker_failed code={}",
                id,
                err.code
            );
        }

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
        let meta: ProfileMeta = match registry::upsert_profile_with_id(&storage_paths, id, &profile.name, true) {
            Ok(updated) => updated.into(),
            Err(_) => ProfileMeta {
                id: profile.id,
                name: profile.name,
                has_password: true,
            },
        };

        // Now that the vault file has been replaced by an encrypted blob, old WAL/SHM sidecars are stale.
        cleanup_sqlite_sidecars(&vault_path);

        let _ = std::fs::remove_dir_all(&backup_root);

        Ok(meta)
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

    let pwd = password;
    if pwd.chars().all(|c| c.is_whitespace()) {
        return Err(ErrorCodeString::new("PASSWORD_REQUIRED"));
    }

    // Prevent concurrent persists while we rotate key material.
    // persist_active_vault takes this guard before reading vault_session.
    let _persist_guard = state
        .vault_persist_guard
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    // Must be unlocked (session exists and matches profile).
    let (bytes, old_key) = {
        let session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        let s = session.as_ref().ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;
        if s.profile_id != id {
            return Err(ErrorCodeString::new("VAULT_LOCKED"));
        }
        best_effort_force_journal_mode_memory(&s.conn, id, "change_password_before_serialize");
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

    recover_incomplete_profile_transitions(&storage_paths, id, &profile.name)?;

    ensure_profile_dirs(&storage_paths, id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let profile_root = profile_dir(&storage_paths, id)?;
    let backup_root = profile_root.join("tmp").join("change_password_backup");
    prepare_transition_backup_root(&backup_root, &storage_paths, id, &profile.name)?;

    let vault_path = vault_db_path(&storage_paths, id)?;
    let vault_backup_path = backup_root.join("vault.db.bak");

    let salt_path = kdf_salt_path(&storage_paths, id)?;
    let salt_backup_path = backup_root.join("kdf_salt.bin.bak");
    let salt_new_path = backup_root.join("kdf_salt.bin.new");

    let key_path = key_check_path(&storage_paths, id)?;
    let key_backup_path = backup_root.join("key_check.bin.bak");
    let key_new_path = backup_root.join("key_check.bin.new");

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
        salt_new_path: PathBuf,
        salt_backed_up: bool,

        key_check_path: PathBuf,
        key_check_backup_path: PathBuf,
        key_check_new_path: PathBuf,
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

        let _ = std::fs::remove_file(&rb.salt_new_path);
        let _ = std::fs::remove_file(&rb.key_check_new_path);

        if rb.attachments_swapped {
            let _ = std::fs::remove_dir_all(&rb.attachments_dir);
            let _ = rename_retry(&rb.attachments_backup_dir, &rb.attachments_dir, 20, Duration::from_millis(50));
        }

        if rb.vault_backed_up {
            let _ = std::fs::remove_file(&rb.vault_path);
            let _ = rename_retry(&rb.vault_backup_path, &rb.vault_path, 20, Duration::from_millis(50));
        }

        if rb.salt_backed_up {
            let _ = std::fs::remove_file(&rb.salt_path);
            let _ = rename_retry(&rb.salt_backup_path, &rb.salt_path, 20, Duration::from_millis(50));
        }

        if rb.key_check_backed_up {
            let _ = std::fs::remove_file(&rb.key_check_path);
            let _ = rename_retry(&rb.key_check_backup_path, &rb.key_check_path, 20, Duration::from_millis(50));
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
        salt_new_path: salt_new_path.clone(),
        salt_backed_up: false,

        key_check_path: key_path.clone(),
        key_check_backup_path: key_backup_path.clone(),
        key_check_new_path: key_new_path.clone(),
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

    // Two-phase commit for key material:
    // 1) write to *.new under backup_root
    // 2) atomically move into place after vault+attachments are committed
    if write_atomic(&salt_new_path, &salt).is_err() {
        rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }
    let key_blob = key_check::create_key_check_blob(id, &*new_key)?;
    if let Err(e) = key_check::write_key_check_blob(&key_new_path, &key_blob) {
        rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
        return Err(e);
    }
    replace_file_retry(&salt_new_path, &salt_path, 20, Duration::from_millis(50))
        .map_err(|_| {
            rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("PROFILE_STORAGE_WRITE")
        })?;
    replace_file_retry(&key_new_path, &key_path, 20, Duration::from_millis(50))
        .map_err(|_| {
            rollback_change_profile_password(&storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("PROFILE_STORAGE_WRITE")
        })?;


    // Disk commit point reached (vault + attachments + key material).
    // Write a commit marker so crash-recovery is deterministic.
    if let Err(err) = write_change_password_commit_marker(&backup_root) {
        log::warn!(
            "[SECURITY][change_profile_password] profile_id={} step=write_commit_marker_failed code={}",
            id,
            err.code
        );
    }

    // Update in-memory session key to keep vault unlocked (only after commit).
    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        let s = session.as_mut().ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;
        if s.profile_id != id {
            // Disk state is already committed; do not attempt rollback here.
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
        let _ = rename_retry(&rb.attachments_backup_dir, &rb.attachments_dir, 20, Duration::from_millis(50));
    }

    let _ = std::fs::remove_file(&rb.vault_path);
    let _ = rename_retry(&rb.vault_backup_path, &rb.vault_path, 20, Duration::from_millis(50));

    if rb.salt_moved {
        let _ = std::fs::remove_file(&rb.salt_path);
        let _ = rename_retry(&rb.salt_backup_path, &rb.salt_path, 20, Duration::from_millis(50));
    }

    if rb.key_check_moved {
        let _ = std::fs::remove_file(&rb.key_check_path);
        let _ = rename_retry(&rb.key_check_backup_path, &rb.key_check_path, 20, Duration::from_millis(50));
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

    recover_incomplete_profile_transitions(&storage_paths, id, &profile.name)?;

    let profile_root = profile_dir(&storage_paths, id)?;
    let backup_root = profile_root.join("tmp").join("remove_password_backup");
    prepare_transition_backup_root(&backup_root, &storage_paths, id, &profile.name)?;

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

    if attachments_dir.exists() {
        let entries = std::fs::read_dir(&attachments_dir).map_err(|_| {
            rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
            ErrorCodeString::new("ATTACHMENT_READ")
        })?;

        for entry in entries {
            let entry = entry.map_err(|_| {
                rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
                ErrorCodeString::new("ATTACHMENT_READ")
            })?;

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

    // Crash-consistency marker: from this point onward we must complete the transition to
    // passwordless (vault + attachments are already plaintext).
    if let Err(e) = write_remove_password_commit_marker(&backup_root) {
        rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
        return Err(e);
    }

    // Now that vault and attachments are plaintext, remove key material last.
    if salt_path.exists() {
        if rename_retry(&salt_path, &salt_backup_path, 20, Duration::from_millis(50)).is_err() {
            rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
            return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
        }
        rb.salt_moved = true;
    }

    if key_path.exists() {
        if rename_retry(&key_path, &key_backup_path, 20, Duration::from_millis(50)).is_err() {
            rollback_remove_profile_password(state, &storage_paths, id, &profile.name, &rb);
            return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
        }
        rb.key_check_moved = true;
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
