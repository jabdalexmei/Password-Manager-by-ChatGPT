use std::sync::Arc;

use tauri::AppHandle;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};

#[derive(Debug, Clone)]
pub enum ExportBackupMode {
    UseProfilePassword,
    CustomPassword(String),
}

pub fn export_backup(
    _app: &AppHandle,
    _state: &Arc<AppState>,
    _output_path: String,
    _mode: ExportBackupMode,
) -> Result<bool> {
    Err(ErrorCodeString::new("BACKUP_UNSUPPORTED_VERSION"))
}

pub fn decrypt_backup_to_temp(
    _app: &AppHandle,
    _state: &Arc<AppState>,
    _backup_path: String,
    _password: String,
) -> Result<String> {
    Err(ErrorCodeString::new("BACKUP_UNSUPPORTED_VERSION"))
}

pub fn finalize_restore(_state: &Arc<AppState>, _temp_id: String) -> Result<bool> {
    Err(ErrorCodeString::new("BACKUP_RESTORE_REQUIRES_UNLOCKED_PROFILE"))
}

pub fn finalize_import_as_new_profile(
    _state: &Arc<AppState>,
    _temp_id: String,
    _new_profile_name: String,
    _password: String,
) -> Result<bool> {
    Err(ErrorCodeString::new("BACKUP_UNSUPPORTED_VERSION"))
}
