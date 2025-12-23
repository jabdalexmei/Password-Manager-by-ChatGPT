use std::sync::Arc;

use crate::app_state::AppState;
use crate::error::Result;
use crate::services::backup_service::{
    decrypt_backup_to_temp, export_backup, finalize_import_as_new_profile, finalize_restore, ExportBackupMode,
};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn export_backup_command(
    app: AppHandle,
    state: State<Arc<AppState>>,
    output_path: String,
    mode: String,
    custom_password: Option<String>,
) -> Result<bool> {
    let mode = match (mode.as_str(), custom_password) {
        ("custom", Some(pwd)) => ExportBackupMode::CustomPassword(pwd),
        _ => ExportBackupMode::UseProfilePassword,
    };

    export_backup(&app, &state, output_path, mode)
}

#[tauri::command]
pub fn decrypt_backup_to_temp_command(
    app: AppHandle,
    state: State<Arc<AppState>>,
    backup_path: String,
    password: String,
) -> Result<String> {
    decrypt_backup_to_temp(&app, &state, backup_path, password)
}

#[tauri::command]
pub fn finalize_restore_command(state: State<Arc<AppState>>, temp_id: String) -> Result<bool> {
    finalize_restore(&state, temp_id)
}

#[tauri::command]
pub fn finalize_import_as_new_profile_command(
    state: State<Arc<AppState>>,
    temp_id: String,
    new_profile_name: String,
    password: String,
) -> Result<bool> {
    finalize_import_as_new_profile(&state, temp_id, new_profile_name, password)
}
