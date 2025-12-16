use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::folders_service;
use crate::types::{CreateFolderInput, Folder, MoveFolderInput, RenameFolderInput};

#[tauri::command]
pub async fn list_folders(state: State<'_, Arc<AppState>>) -> Result<Vec<Folder>> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::list_folders(&state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn create_folder(
    input: CreateFolderInput,
    state: State<'_, Arc<AppState>>,
) -> Result<Folder> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::create_folder(input, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn rename_folder(input: RenameFolderInput, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::rename_folder(input, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn move_folder(input: MoveFolderInput, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::move_folder(input, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn delete_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::delete_folder(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn list_deleted_folders(state: State<'_, Arc<AppState>>) -> Result<Vec<Folder>> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::list_deleted_folders(&state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn restore_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::restore_folder(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn purge_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || folders_service::purge_folder(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
