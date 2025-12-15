use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::data::profiles::registry;
use crate::data::sqlite::init::init_database;
use crate::error::{ErrorCodeString, Result};

pub fn login_vault(id: &str, password: Option<String>, state: &State<Arc<AppState>>) -> Result<bool> {
    let record = registry::get_profile(id)?.ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;
    if let Some(hash) = record.password_hash {
        let pwd = password.unwrap_or_default();
        let valid = crate::data::crypto::kdf::verify_password(&pwd, &hash);
        if !valid {
            return Err(ErrorCodeString::new("INVALID_PASSWORD"));
        }
    }
    let _ = init_database(id);
    if let Ok(mut active) = state.active_profile.lock() {
        *active = Some(id.to_string());
    }
    if let Ok(mut logged_in) = state.logged_in_profile.lock() {
        *logged_in = Some(id.to_string());
    }
    Ok(true)
}

pub fn lock_vault(state: &State<Arc<AppState>>) -> Result<bool> {
    if let Ok(mut logged_in) = state.logged_in_profile.lock() {
        *logged_in = None;
    }
    Ok(true)
}

pub fn is_logged_in(state: &State<Arc<AppState>>) -> Result<bool> {
    if let Ok(logged_in) = state.logged_in_profile.lock() {
        Ok(logged_in.is_some())
    } else {
        Err(ErrorCodeString::new("STATE_UNAVAILABLE"))
    }
}

pub fn auto_lock_cleanup(state: &State<Arc<AppState>>) -> Result<bool> {
    // For step 1, reuse is_logged_in flag. Real auto-lock timer can be added later.
    is_logged_in(state)
}

pub fn health_check() -> Result<bool> {
    Ok(true)
}
