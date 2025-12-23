use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::types::PasswordHistoryRow;

fn require_logged_in(state: &Arc<AppState>) -> Result<String> {
    let active_profile = state
        .active_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();
    let logged_in_profile = state
        .logged_in_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();

    match (active_profile, logged_in_profile) {
        (Some(active), Some(logged)) if active == logged => Ok(active),
        _ => Err(ErrorCodeString::new("VAULT_LOCKED")),
    }
}

pub fn list_history(state: &Arc<AppState>, datacard_id: &str) -> Result<Vec<PasswordHistoryRow>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_password_history(state, &profile_id, datacard_id)
}

pub fn clear_history(state: &Arc<AppState>, datacard_id: &str) -> Result<()> {
    let profile_id = require_logged_in(state)?;
    repo_impl::clear_password_history(state, &profile_id, datacard_id)?;
    Ok(())
}
