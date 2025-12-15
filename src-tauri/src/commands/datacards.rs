use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::Result;
use crate::services::datacards_service;
use crate::types::{
    CreateDataCardInput, DataCard, MoveDataCardInput, UpdateDataCardInput,
};

#[tauri::command]
pub fn list_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    datacards_service::list_datacards(&state)
}

#[tauri::command]
pub fn get_datacard(id: String, state: State<Arc<AppState>>) -> Result<DataCard> {
    datacards_service::get_datacard(id, &state)
}

#[tauri::command]
pub fn create_datacard(
    input: CreateDataCardInput,
    state: State<Arc<AppState>>,
) -> Result<DataCard> {
    datacards_service::create_datacard(input, &state)
}

#[tauri::command]
pub fn update_datacard(
    input: UpdateDataCardInput,
    state: State<Arc<AppState>>,
) -> Result<bool> {
    datacards_service::update_datacard(input, &state)
}

#[tauri::command]
pub fn move_datacard(input: MoveDataCardInput, state: State<Arc<AppState>>) -> Result<bool> {
    datacards_service::move_datacard(input, &state)
}

#[tauri::command]
pub fn delete_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    datacards_service::delete_datacard(id, &state)
}

#[tauri::command]
pub fn list_deleted_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    datacards_service::list_deleted_datacards(&state)
}

#[tauri::command]
pub fn restore_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    datacards_service::restore_datacard(id, &state)
}

#[tauri::command]
pub fn purge_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    datacards_service::purge_datacard(id, &state)
}
