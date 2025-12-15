use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::Result;
use crate::services::settings_service::{get_settings_command, update_settings_command};
use crate::types::UserSettings;

#[tauri::command]
pub fn get_settings(state: State<Arc<AppState>>) -> Result<UserSettings> {
    get_settings_command(&state)
}

#[tauri::command]
pub fn update_settings(settings: UserSettings, state: State<Arc<AppState>>) -> Result<bool> {
    update_settings_command(&state, settings)
}
