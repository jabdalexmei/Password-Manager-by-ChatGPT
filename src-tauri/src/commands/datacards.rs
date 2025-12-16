use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::datacards_service;
use crate::types::{
    CreateDataCardInput, DataCard, DataCardSummary, MoveDataCardInput, UpdateDataCardInput,
};

#[tauri::command]
pub async fn list_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::list_datacards(&state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn get_datacard(id: String, state: State<Arc<AppState>>) -> Result<DataCard> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::get_datacard(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn create_datacard(
    input: CreateDataCardInput,
    state: State<Arc<AppState>>,
) -> Result<DataCard> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::create_datacard(input, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn update_datacard(
    input: UpdateDataCardInput,
    state: State<Arc<AppState>>,
) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::update_datacard(input, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn move_datacard_to_folder(
    input: MoveDataCardInput,
    state: State<Arc<AppState>>,
) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || {
        datacards_service::move_datacard_to_folder(input, &state)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn delete_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::delete_datacard(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn list_deleted_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::list_deleted_datacards(&state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn restore_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::restore_datacard(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn purge_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::purge_datacard(id, &state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn list_datacards_summary_command(
    state: State<Arc<AppState>>,
) -> Result<Vec<DataCardSummary>> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || datacards_service::list_datacards_summary(&state))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn list_deleted_datacards_summary_command(
    state: State<Arc<AppState>>,
) -> Result<Vec<DataCardSummary>> {
    let state = state.clone();
    tauri::async_runtime::spawn_blocking(move || {
        datacards_service::list_deleted_datacards_summary(&state)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
