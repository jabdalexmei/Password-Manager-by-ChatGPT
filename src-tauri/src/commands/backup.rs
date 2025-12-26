use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::backup_service::{
    backup_create as backup_create_service, backup_create_if_due_auto as backup_create_if_due_auto_service,
    backup_list as backup_list_service, backup_restore as backup_restore_service, BackupListItem,
};

#[tauri::command]
pub async fn backup_create(
    destination_path: Option<String>,
    use_default_path: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        backup_create_service(&app, destination_path, use_default_path)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn backup_list(state: State<'_, Arc<AppState>>) -> Result<Vec<BackupListItem>> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || backup_list_service(&app))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn backup_restore(backup_path: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || backup_restore_service(&app, backup_path))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn backup_create_if_due_auto(state: State<'_, Arc<AppState>>) -> Result<Option<String>> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || backup_create_if_due_auto_service(&app))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
