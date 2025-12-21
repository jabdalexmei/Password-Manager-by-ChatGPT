use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::settings_service::get_settings;
use crate::types::{CreateFolderInput, Folder, MoveFolderInput, RenameFolderInput};

fn require_logged_in(state: &Arc<AppState>) -> Result<String> {
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

pub fn list_folders(state: &Arc<AppState>) -> Result<Vec<Folder>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_folders(&state.storage_paths, &profile_id)
}

pub fn create_folder(input: CreateFolderInput, state: &Arc<AppState>) -> Result<Folder> {
    let profile_id = require_logged_in(state)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ErrorCodeString::new("FOLDER_NAME_REQUIRED"));
    }
    repo_impl::create_folder(&state.storage_paths, &profile_id, name, &input.parent_id)
}

pub fn rename_folder(input: RenameFolderInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ErrorCodeString::new("FOLDER_NAME_REQUIRED"));
    }
    repo_impl::rename_folder(&state.storage_paths, &profile_id, &input.id, name)
}

pub fn move_folder(input: MoveFolderInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::move_folder(&state.storage_paths, &profile_id, &input.id, &input.parent_id)
}

pub fn delete_folder_only(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let folder = repo_impl::get_folder(&state.storage_paths, &profile_id, &id)?;
    if folder.is_system {
        return Err(ErrorCodeString::new("FOLDER_IS_SYSTEM"));
    }

    repo_impl::move_datacards_to_root(&state.storage_paths, &profile_id, &id)?;
    repo_impl::purge_folder(&state.storage_paths, &profile_id, &id)
}

pub fn delete_folder_and_cards(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let folder = repo_impl::get_folder(&state.storage_paths, &profile_id, &id)?;
    if folder.is_system {
        return Err(ErrorCodeString::new("FOLDER_IS_SYSTEM"));
    }

    let settings = get_settings(&state.storage_paths, &profile_id)?;

    if settings.soft_delete_enabled {
        repo_impl::soft_delete_datacards_in_folder(&state.storage_paths, &profile_id, &id)?;
    } else {
        repo_impl::purge_datacards_in_folder(&state.storage_paths, &profile_id, &id)?;
    }

    repo_impl::purge_folder(&state.storage_paths, &profile_id, &id)
}
