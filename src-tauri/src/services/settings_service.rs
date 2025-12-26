use std::fs;
use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::fs::atomic_write::write_atomic;
use crate::data::profiles::paths::user_settings_path;
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use crate::types::UserSettings;

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

fn validate_settings(settings: &UserSettings) -> Result<()> {
    let in_range = |value: i64, min: i64, max: i64| (min..=max).contains(&value);

    let valid_values = [
        in_range(settings.auto_hide_secret_timeout_seconds, 1, 600),
        in_range(settings.clipboard_clear_timeout_seconds, 1, 600),
        in_range(settings.auto_lock_timeout, 30, 86_400),
        in_range(settings.trash_retention_days, 1, 3_650),
        in_range(settings.backup_retention_days, 1, 3_650),
    ]
    .into_iter()
    .all(|v| v);
    let valid_auto_backup_interval = if settings.backups_enabled {
        in_range(settings.auto_backup_interval_minutes, 5, 525_600)
    } else {
        true
    };

    let valid_frequency =
        ["daily", "weekly", "monthly"].contains(&settings.backup_frequency.as_str());
    let valid_sort_field =
        ["created_at", "updated_at", "title"].contains(&settings.default_sort_field.as_str());
    let valid_sort_direction = ["ASC", "DESC"].contains(&settings.default_sort_direction.as_str());

    if valid_values && valid_auto_backup_interval && valid_frequency && valid_sort_field && valid_sort_direction {
        Ok(())
    } else {
        Err(ErrorCodeString::new("SETTINGS_VALIDATION_FAILED"))
    }
}

pub fn get_settings(sp: &StoragePaths, profile_id: &str) -> Result<UserSettings> {
    let path = user_settings_path(sp, profile_id)?;
    if !path.exists() {
        let defaults = UserSettings::default();
        let serialized = serde_json::to_string_pretty(&defaults)
            .map_err(|_| ErrorCodeString::new("SETTINGS_WRITE"))?;
        write_atomic(&path, serialized.as_bytes())
            .map_err(|_| ErrorCodeString::new("SETTINGS_WRITE"))?;
        return Ok(defaults);
    }

    let content = fs::read_to_string(&path).map_err(|_| ErrorCodeString::new("SETTINGS_READ"))?;
    serde_json::from_str(&content).map_err(|_| ErrorCodeString::new("SETTINGS_PARSE"))
}

pub fn update_settings(
    sp: &StoragePaths,
    new_settings: UserSettings,
    profile_id: &str,
) -> Result<bool> {
    validate_settings(&new_settings)?;
    let path = user_settings_path(sp, profile_id)?;
    let serialized = serde_json::to_string_pretty(&new_settings)
        .map_err(|_| ErrorCodeString::new("SETTINGS_WRITE"))?;
    write_atomic(&path, serialized.as_bytes())
        .map_err(|_| ErrorCodeString::new("SETTINGS_WRITE"))?;
    Ok(true)
}

pub fn update_settings_command(state: &Arc<AppState>, settings: UserSettings) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let storage_paths = state.get_storage_paths()?;
    update_settings(&storage_paths, settings, &profile_id)
}

pub fn get_settings_command(state: &Arc<AppState>) -> Result<UserSettings> {
    let profile_id = require_logged_in(state)?;
    let storage_paths = state.get_storage_paths()?;
    get_settings(&storage_paths, &profile_id)
}
