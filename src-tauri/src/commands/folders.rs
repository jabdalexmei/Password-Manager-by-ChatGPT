use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::Result;
use crate::services::folders_service;
use crate::types::{CreateFolderInput, Folder, MoveFolderInput, RenameFolderInput};

#[tauri::command]
pub fn list_folders(state: State<Arc<AppState>>) -> Result<Vec<Folder>> {
    folders_service::list_folders(&state)
}

#[tauri::command]
pub fn create_folder(input: CreateFolderInput, state: State<Arc<AppState>>) -> Result<Folder> {
    folders_service::create_folder(input, &state)
}

#[tauri::command]
pub fn rename_folder(input: RenameFolderInput, state: State<Arc<AppState>>) -> Result<bool> {
    folders_service::rename_folder(input, &state)
}

#[tauri::command]
pub fn move_folder(input: MoveFolderInput, state: State<Arc<AppState>>) -> Result<bool> {
    folders_service::move_folder(input, &state)
}

#[tauri::command]
pub fn delete_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    folders_service::delete_folder(id, &state)
}

#[tauri::command]
pub fn list_deleted_folders(state: State<Arc<AppState>>) -> Result<Vec<Folder>> {
    folders_service::list_deleted_folders(&state)
}

#[tauri::command]
pub fn restore_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    folders_service::restore_folder(id, &state)
}

#[tauri::command]
pub fn purge_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    folders_service::purge_folder(id, &state)
}
