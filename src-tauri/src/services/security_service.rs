use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::profiles::registry;
use crate::data::sqlite::init::init_database;
use crate::data::sqlite::pool::clear_pool;
use crate::error::{ErrorCodeString, Result};

pub fn login_vault(
    id: &str,
    password: Option<String>,
    state: &Arc<AppState>,
) -> Result<bool> {
    let pwd = password.unwrap_or_default();
    let verified = registry::verify_profile_password(&state.storage_paths, id, &pwd)?;
    if !verified {
        return Err(ErrorCodeString::new("INVALID_PASSWORD"));
    }

    init_database(&state.storage_paths, id)?;
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
        clear_pool(&id);
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
