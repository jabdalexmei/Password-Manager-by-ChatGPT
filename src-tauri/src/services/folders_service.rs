use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::types::{CreateFolderInput, Folder, MoveFolderInput, RenameFolderInput};

fn require_logged_in(state: &State<Arc<AppState>>) -> Result<String> {
    let active_profile = state
        .active_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();
    let logged_in_profile = state
        .logged_in_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();

    match (active_profile, logged_in_profile) {
        (Some(active), Some(logged)) if active == logged => Ok(active),
        _ => Err(ErrorCodeString::new("VAULT_LOCKED")),
    }
}

pub fn list_folders(state: &State<Arc<AppState>>) -> Result<Vec<Folder>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_folders(&profile_id, false)
}

pub fn create_folder(input: CreateFolderInput, state: &State<Arc<AppState>>) -> Result<Folder> {
    let profile_id = require_logged_in(state)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ErrorCodeString::new("FOLDER_NAME_REQUIRED"));
    }
    repo_impl::create_folder(&profile_id, name, &input.parent_id)
}

pub fn rename_folder(input: RenameFolderInput, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ErrorCodeString::new("FOLDER_NAME_REQUIRED"));
    }
    repo_impl::rename_folder(&profile_id, &input.id, name)
}

pub fn move_folder(input: MoveFolderInput, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::move_folder(&profile_id, &input.id, &input.parent_id)
}

pub fn delete_folder(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let folder = repo_impl::get_folder(&profile_id, &id)?;
    if folder.is_system {
        return Err(ErrorCodeString::new("FOLDER_IS_SYSTEM"));
    }
    repo_impl::soft_delete_folder(&profile_id, &id)?;
    repo_impl::soft_delete_datacards_in_folder(&profile_id, &id)
}

pub fn list_deleted_folders(state: &State<Arc<AppState>>) -> Result<Vec<Folder>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_folders(&profile_id, true).map(|mut folders| {
        folders.retain(|f| f.deleted_at.is_some());
        folders
    })
}

pub fn restore_folder(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::restore_folder(&profile_id, &id)?;
    repo_impl::restore_datacards_in_folder(&profile_id, &id)
}

pub fn purge_folder(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::purge_datacards_in_folder(&profile_id, &id)?;
    repo_impl::purge_folder(&profile_id, &id)
}
