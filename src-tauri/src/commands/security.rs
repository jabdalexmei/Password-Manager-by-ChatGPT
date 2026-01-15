use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::security_service;
use crate::types::ProfileMeta;

#[tauri::command]
pub async fn login_vault(
    id: String,
    password: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<bool> {
    let app_state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        security_service::login_vault(&id, password, &app_state)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn lock_vault(state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app_state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || security_service::lock_vault(&app_state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn is_logged_in(state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app_state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || security_service::is_logged_in(&app_state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn profile_set_password(
    id: String,
    password: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ProfileMeta> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        security_service::set_profile_password(&id, &password, &app_state)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn profile_change_password(
    id: String,
    password: String,
    state: State<'_, Arc<AppState>>,
) -> Result<bool> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        security_service::change_profile_password(&id, &password, &app_state)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn health_check() -> Result<bool> {
    tauri::async_runtime::spawn_blocking(security_service::health_check)
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
