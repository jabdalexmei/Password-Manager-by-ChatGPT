use std::path::Path;
use std::ptr::NonNull;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use rusqlite::ffi;
use rusqlite::serialize::OwnedData;
use rusqlite::DatabaseName;
use zeroize::{Zeroize, Zeroizing};

use crate::app_state::{AppState, VaultSession};
use crate::data::crypto::{cipher, kdf, key_check};
use crate::data::fs::atomic_write::write_atomic;
use crate::data::profiles::paths::{ensure_profile_dirs, kdf_salt_path, vault_db_path};
use crate::data::profiles::registry;
use crate::data::sqlite::init::init_database_passwordless;
use crate::data::sqlite::migrations;
use crate::data::sqlite::pool::clear_pool;
use crate::error::{ErrorCodeString, Result};
use crate::services::attachments_service;
use crate::types::ProfileMeta;

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

    let mut conn = rusqlite::Connection::open_in_memory()
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;
    let owned = owned_data_from_bytes(decrypted)?;
    conn.deserialize(DatabaseName::Main, owned, false)
        .map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;

    migrations::migrate_to_latest(&conn)?;
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
    let storage_paths = state.get_storage_paths()?;

    let profile = registry::get_profile(&storage_paths, id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    if profile.has_password {
        return Err(ErrorCodeString::new("PROFILE_ALREADY_PROTECTED"));
    }

    let pwd = password.trim();
    if pwd.is_empty() {
        return Err(ErrorCodeString::new("PASSWORD_REQUIRED"));
    }

    ensure_profile_dirs(&storage_paths, id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    // Close file-based sqlite connections before touching vault.db bytes.
    clear_pool(id);

    // Ensure DB exists (passwordless profiles may not have opened yet in some flows).
    init_database_passwordless(&storage_paths, id)?;

    let vault_path = vault_db_path(&storage_paths, id)?;
    if !vault_path.exists() {
        return Err(ErrorCodeString::new("VAULT_CORRUPTED"));
    }

    // Serialize passwordless sqlite file to bytes.
    let conn = rusqlite::Connection::open(&vault_path)
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;
    migrations::migrate_to_latest(&conn)?;
    let serialized = conn
        .serialize(DatabaseName::Main)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    drop(conn);

    let bytes = serialized.to_vec();

    // Create new salt + key.
    let salt = kdf::generate_kdf_salt();
    let salt_path = kdf_salt_path(&storage_paths, id)?;
    write_atomic(&salt_path, &salt).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let key = Zeroizing::new(kdf::derive_master_key(pwd, &salt)?);

    // Create key check file first (so we can validate later).
    key_check::create_key_check_file(&storage_paths, id, &*key)?;

    // Encrypt vault bytes into vault.db (overwriting sqlite file).
    let encrypted = cipher::encrypt_vault_blob(id, &*key, &bytes)?;
    cipher::write_encrypted_file(&vault_path, &encrypted)?;
    cleanup_sqlite_sidecars(&vault_path);

    // Switch runtime session to protected in-memory session so app stays unlocked.
    let mut mem_conn = rusqlite::Connection::open_in_memory()
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;
    let owned = owned_data_from_bytes(bytes)?;
    mem_conn
        .deserialize(DatabaseName::Main, owned, false)
        .map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;
    migrations::migrate_to_latest(&mem_conn)?;
    migrations::validate_core_schema(&mem_conn)
        .map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;

    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_LOCK_POISONED"))?;
        *session = Some(VaultSession {
            profile_id: id.to_string(),
            conn: mem_conn,
            key: *key,
        });
    }

    // Update registry flag.
    let updated = registry::upsert_profile_with_id(&storage_paths, id, &profile.name, true)?;
    Ok(updated.into())
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

    // Must be unlocked (session exists and matches profile).
    let (bytes, old_profile_id) = {
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
        (serialized.to_vec(), s.profile_id.clone())
    };

    let salt = kdf::generate_kdf_salt();
    let salt_path = kdf_salt_path(&storage_paths, id)?;
    write_atomic(&salt_path, &salt).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    let key = Zeroizing::new(kdf::derive_master_key(pwd, &salt)?);

    key_check::create_key_check_file(&storage_paths, id, &*key)?;

    let vault_path = vault_db_path(&storage_paths, id)?;
    let encrypted = cipher::encrypt_vault_blob(&old_profile_id, &*key, &bytes)?;
    cipher::write_encrypted_file(&vault_path, &encrypted)?;

    // Update in-memory session key to keep vault unlocked.
    {
        let mut session = state
            .vault_session
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        let s = session.as_mut().ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))?;
        if s.profile_id != id {
            return Err(ErrorCodeString::new("VAULT_LOCKED"));
        }
        s.key = *key;
    }

    Ok(true)
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
