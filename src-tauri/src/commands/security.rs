use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::Result;
use crate::services::security_service;

#[tauri::command]
pub fn login_vault(
    id: String,
    password: Option<String>,
    state: State<Arc<AppState>>,
) -> Result<bool> {
    security_service::login_vault(&id, password, &state)
}

#[tauri::command]
pub fn lock_vault(state: State<Arc<AppState>>) -> Result<bool> {
    security_service::lock_vault(&state)
}

#[tauri::command]
pub fn is_logged_in(state: State<Arc<AppState>>) -> Result<bool> {
    security_service::is_logged_in(&state)
}

#[tauri::command]
pub fn auto_lock_cleanup(state: State<Arc<AppState>>) -> Result<bool> {
    security_service::auto_lock_cleanup(&state)
}

#[tauri::command]
pub fn health_check() -> Result<bool> {
    security_service::health_check()
}
