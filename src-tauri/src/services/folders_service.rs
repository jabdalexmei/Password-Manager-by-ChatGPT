use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::types::{CreateFolderInput, Folder, MoveFolderInput, RenameFolderInput};

fn require_logged_in(state: &State<Arc<AppState>>) -> Result<String> {
    state
        .logged_in_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone()
        .ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))
}

pub fn list_folders(state: &State<Arc<AppState>>) -> Result<Vec<Folder>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_folders(&profile_id, false)
}

pub fn create_folder(input: CreateFolderInput, state: &State<Arc<AppState>>) -> Result<Folder> {
    let profile_id = require_logged_in(state)?;
    repo_impl::create_folder(&profile_id, &input.name, &input.parent_id)
}

pub fn rename_folder(input: RenameFolderInput, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::rename_folder(&profile_id, &input.id, &input.name)
}

pub fn move_folder(input: MoveFolderInput, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::move_folder(&profile_id, &input.id, &input.parent_id)
}

pub fn delete_folder(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::soft_delete_folder(&profile_id, &id)
}

pub fn list_deleted_folders(state: &State<Arc<AppState>>) -> Result<Vec<Folder>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_folders(&profile_id, true)
        .map(|mut folders| {
            folders.retain(|f| f.deleted_at.is_some());
            folders
        })
}

pub fn restore_folder(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::restore_folder(&profile_id, &id)
}

pub fn purge_folder(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::purge_folder(&profile_id, &id)
}
