use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::settings_service::{get_settings_command, update_settings_command};
use crate::types::UserSettings;

#[tauri::command]
pub async fn get_settings(state: State<Arc<AppState>>) -> Result<UserSettings> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || get_settings_command(&state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn update_settings(settings: UserSettings, state: State<Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || update_settings_command(&state, settings))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
