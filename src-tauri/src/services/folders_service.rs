use std::fs;
use std::sync::Arc;

use chrono::Utc;

use crate::app_state::AppState;
use crate::data::profiles::paths::attachment_file_path;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::security_service;
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
    repo_impl::list_folders(state, &profile_id)
}

pub fn create_folder(input: CreateFolderInput, state: &Arc<AppState>) -> Result<Folder> {
    let profile_id = require_logged_in(state)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ErrorCodeString::new("FOLDER_NAME_REQUIRED"));
    }
    let folder = repo_impl::create_folder(state, &profile_id, name, &input.parent_id)?;
    security_service::persist_active_vault(state)?;
    Ok(folder)
}

pub fn rename_folder(input: RenameFolderInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ErrorCodeString::new("FOLDER_NAME_REQUIRED"));
    }
    let renamed = repo_impl::rename_folder(state, &profile_id, &input.id, name)?;
    security_service::persist_active_vault(state)?;
    Ok(renamed)
}

pub fn move_folder(input: MoveFolderInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let moved = repo_impl::move_folder(state, &profile_id, &input.id, &input.parent_id)?;
    security_service::persist_active_vault(state)?;
    Ok(moved)
}

pub fn delete_folder_only(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let folder = repo_impl::get_folder(state, &profile_id, &id)?;
    if folder.is_system {
        return Err(ErrorCodeString::new("FOLDER_IS_SYSTEM"));
    }

    repo_impl::move_datacards_to_root(state, &profile_id, &id)?;
    let deleted = repo_impl::purge_folder(state, &profile_id, &id)?;
    security_service::persist_active_vault(state)?;
    Ok(deleted)
}

pub fn delete_folder_and_cards(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let folder = repo_impl::get_folder(state, &profile_id, &id)?;
    if folder.is_system {
        return Err(ErrorCodeString::new("FOLDER_IS_SYSTEM"));
    }

    let settings = get_settings(&state.storage_paths, &profile_id)?;

    if settings.soft_delete_enabled {
        let now = Utc::now().to_rfc3339();
        let datacard_ids = repo_impl::list_datacard_ids_in_folder(state, &profile_id, &id, false)?;

        for datacard_id in datacard_ids {
            repo_impl::soft_delete_attachments_by_datacard(state, &profile_id, &datacard_id, &now)?;
        }
        repo_impl::soft_delete_datacards_in_folder(state, &profile_id, &id)?;
    } else {
        let datacard_ids = repo_impl::list_datacard_ids_in_folder(state, &profile_id, &id, true)?;

        for datacard_id in datacard_ids {
            let attachments =
                repo_impl::list_all_attachments_by_datacard(state, &profile_id, &datacard_id)?;

            for attachment in attachments {
                let file_path =
                    attachment_file_path(&state.storage_paths, &profile_id, &attachment.id);
                let _ = fs::remove_file(file_path);
                if let Err(err) = repo_impl::purge_attachment(state, &profile_id, &attachment.id) {
                    if err.code != "ATTACHMENT_NOT_FOUND" {
                        return Err(err);
                    }
                }
            }
        }
        repo_impl::purge_datacards_in_folder(state, &profile_id, &id)?;
    }

    let deleted = repo_impl::purge_folder(state, &profile_id, &id)?;
    security_service::persist_active_vault(state)?;
    Ok(deleted)
}
