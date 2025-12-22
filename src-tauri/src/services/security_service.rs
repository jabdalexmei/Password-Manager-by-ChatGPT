use std::sync::Arc;

use zeroize::Zeroizing;

use crate::app_state::AppState;
use crate::data::crypto::{cipher, kdf, key_check};
use crate::data::profiles::paths::{kdf_salt_path, vault_db_path};
use crate::data::profiles::registry;
use crate::data::sqlite::init::init_database_passwordless;
use crate::data::sqlite::pool::clear_pool;
use crate::error::{ErrorCodeString, Result};

fn open_protected_vault_session(
    profile_id: &str,
    password: &str,
    state: &Arc<AppState>,
) -> Result<()> {
    let salt_path = kdf_salt_path(&state.storage_paths, profile_id);
    if !salt_path.exists() {
        return Err(ErrorCodeString::new("KDF_SALT_MISSING"));
    }
    let salt =
        std::fs::read(&salt_path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    let key = Zeroizing::new(kdf::derive_master_key(password, &salt)?);

    if !key_check::verify_key_check_file(&state.storage_paths, profile_id, &key)? {
        return Err(ErrorCodeString::new("INVALID_PASSWORD"));
    }

    let vault_path = vault_db_path(&state.storage_paths, profile_id);
    if !vault_path.exists() {
        return Err(ErrorCodeString::new("VAULT_CORRUPTED"));
    }
    let encrypted = cipher::read_encrypted_file(&vault_path)?;
    let decrypted = cipher::decrypt_vault_blob(profile_id, &key, &encrypted)
        .map_err(|_| ErrorCodeString::new("VAULT_DECRYPT_FAILED"))?;

    let uri = format!("file:pm_vault_{}?mode=memory&cache=shared", profile_id);
    let flags = rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
        | rusqlite::OpenFlags::SQLITE_OPEN_CREATE
        | rusqlite::OpenFlags::SQLITE_OPEN_URI
        | rusqlite::OpenFlags::SQLITE_OPEN_SHARED_CACHE;
    let conn = rusqlite::Connection::open_with_flags(&uri, flags)
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;
    conn.deserialize("main", &decrypted)
        .map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;

    if let Ok(mut keeper) = state.vault_keeper_conn.lock() {
        *keeper = Some(conn);
    }
    if let Ok(mut uri_slot) = state.vault_db_uri.lock() {
        *uri_slot = Some(uri);
    }
    if let Ok(mut vault_key) = state.vault_key.lock() {
        *vault_key = Some(key);
    }

    Ok(())
}

pub fn login_vault(id: &str, password: Option<String>, state: &Arc<AppState>) -> Result<bool> {
    let profile = registry::get_profile(&state.storage_paths, id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;
    let pwd = password.unwrap_or_default();
    let is_passwordless = profile.password_hash.is_none();

    if is_passwordless {
        init_database_passwordless(&state.storage_paths, id)?;
    } else {
        open_protected_vault_session(id, &pwd, state)?;
    }

    if let Ok(mut active) = state.active_profile.lock() {
        *active = Some(id.to_string());
    }
    if let Ok(mut logged_in) = state.logged_in_profile.lock() {
        *logged_in = Some(id.to_string());
    }
    Ok(true)
}

pub fn lock_vault(state: &Arc<AppState>) -> Result<bool> {
    let profile_id = state
        .logged_in_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();

    if let Some(id) = profile_id {
        let mut keeper = state
            .vault_keeper_conn
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        let key = state
            .vault_key
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .take();

        if let (Some(conn), Some(key_material)) = (keeper.take(), key) {
            let bytes = conn
                .serialize("main")
                .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
            let encrypted = cipher::encrypt_vault_blob(&id, &key_material, &bytes)?;
            cipher::write_encrypted_file(&vault_db_path(&state.storage_paths, &id), &encrypted)?;
        }

        clear_pool(&id);

        if let Ok(mut uri) = state.vault_db_uri.lock() {
            *uri = None;
        }
        if let Ok(mut vault_key) = state.vault_key.lock() {
            *vault_key = None;
        }
    }

    if let Ok(mut logged_in) = state.logged_in_profile.lock() {
        *logged_in = None;
    }
    Ok(true)
}

pub fn is_logged_in(state: &Arc<AppState>) -> Result<bool> {
    if let Ok(logged_in) = state.logged_in_profile.lock() {
        Ok(logged_in.is_some())
    } else {
        Err(ErrorCodeString::new("STATE_UNAVAILABLE"))
    }
}

pub fn auto_lock_cleanup(state: &Arc<AppState>) -> Result<bool> {
    // For step 1, reuse is_logged_in flag. Real auto-lock timer can be added later.
    is_logged_in(state)
}

pub fn health_check() -> Result<bool> {
    Ok(true)
}
