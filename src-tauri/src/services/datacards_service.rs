use chrono::Utc;
use std::fs;
use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::profiles::paths::attachment_file_path;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::security_service;
use crate::services::settings_service::get_settings;
use crate::types::{
    CreateDataCardInput, DataCard, DataCardSummary, MoveDataCardInput, SetDataCardFavoriteInput,
    UpdateDataCardInput,
};

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

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    for tag in tags {
        let trimmed = tag.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !result.contains(&trimmed.to_string()) {
            result.push(trimmed.to_string());
        }
    }
    result
}

pub fn list_datacards(state: &Arc<AppState>) -> Result<Vec<DataCard>> {
    let profile_id = require_logged_in(state)?;
    let storage_paths = state.get_storage_paths()?;
    let settings = get_settings(&storage_paths, &profile_id)?;
    repo_impl::list_datacards(
        state,
        &profile_id,
        false,
        &settings.default_sort_field,
        &settings.default_sort_direction,
    )
}

pub fn list_datacards_summary(state: &Arc<AppState>) -> Result<Vec<DataCardSummary>> {
    let profile_id = require_logged_in(state)?;
    let storage_paths = state.get_storage_paths()?;
    let settings = get_settings(&storage_paths, &profile_id)?;
    repo_impl::list_datacards_summary(
        state,
        &profile_id,
        &settings.default_sort_field,
        &settings.default_sort_direction,
    )
}

pub fn get_datacard(id: String, state: &Arc<AppState>) -> Result<DataCard> {
    let profile_id = require_logged_in(state)?;
    repo_impl::get_datacard(state, &profile_id, &id)
}

pub fn create_datacard(input: CreateDataCardInput, state: &Arc<AppState>) -> Result<DataCard> {
    let profile_id = require_logged_in(state)?;
    let mut sanitized = input;
    sanitized.title = sanitized.title.trim().to_string();
    if sanitized.title.is_empty() {
        return Err(ErrorCodeString::new("DATACARD_TITLE_REQUIRED"));
    }
    sanitized.tags = normalize_tags(sanitized.tags);
    sanitized.totp_uri = sanitized
        .totp_uri
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });

    let created = repo_impl::create_datacard(state, &profile_id, &sanitized)?;
    security_service::persist_active_vault(state)?;
    Ok(created)
}

pub fn update_datacard(input: UpdateDataCardInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let mut sanitized = input;
    sanitized.title = sanitized.title.trim().to_string();
    if sanitized.title.is_empty() {
        return Err(ErrorCodeString::new("DATACARD_TITLE_REQUIRED"));
    }
    sanitized.tags = normalize_tags(sanitized.tags);
    sanitized.totp_uri = sanitized
        .totp_uri
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });

    let updated = repo_impl::update_datacard(state, &profile_id, &sanitized)?;
    security_service::persist_active_vault(state)?;
    Ok(updated)
}

pub fn move_datacard_to_folder(input: MoveDataCardInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let moved = repo_impl::move_datacard(state, &profile_id, &input.id, &input.folder_id)?;
    security_service::persist_active_vault(state)?;
    Ok(moved)
}

pub fn delete_datacard(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let storage_paths = state.get_storage_paths()?;
    let settings = get_settings(&storage_paths, &profile_id)?;
    if settings.soft_delete_enabled {
        let now = Utc::now().to_rfc3339();
        repo_impl::soft_delete_datacard(state, &profile_id, &id, &now)?;
        repo_impl::soft_delete_attachments_by_datacard(state, &profile_id, &id, &now)?;
        security_service::persist_active_vault(state)?;
        Ok(true)
    } else {
        purge_datacard_with_attachments(state, &profile_id, &id)
    }
}

pub fn list_deleted_datacards(state: &Arc<AppState>) -> Result<Vec<DataCard>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_deleted_datacards(state, &profile_id)
}

pub fn list_deleted_datacards_summary(state: &Arc<AppState>) -> Result<Vec<DataCardSummary>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_deleted_datacards_summary(state, &profile_id)
}

pub fn restore_datacard(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::restore_datacard(state, &profile_id, &id)?;
    repo_impl::restore_attachments_by_datacard(state, &profile_id, &id)?;
    security_service::persist_active_vault(state)?;
    Ok(true)
}

pub fn purge_datacard(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    purge_datacard_with_attachments(state, &profile_id, &id)
}

fn purge_datacard_with_attachments(
    state: &Arc<AppState>,
    profile_id: &str,
    id: &str,
) -> Result<bool> {
    let attachments = repo_impl::list_all_attachments_by_datacard(state, profile_id, id)?;
    let storage_paths = state.get_storage_paths()?;
    for attachment in attachments {
        let file_path = attachment_file_path(&storage_paths, profile_id, &attachment.id)?;
        let _ = fs::remove_file(file_path);
        if let Err(err) = repo_impl::purge_attachment(state, profile_id, &attachment.id) {
            if err.code == "ATTACHMENT_NOT_FOUND" {
                continue;
            }
            return Err(err);
        }
    }

    let purged = repo_impl::purge_datacard(state, profile_id, id)?;
    security_service::persist_active_vault(state)?;
    Ok(purged)
}

pub fn set_datacard_favorite(
    input: SetDataCardFavoriteInput,
    state: &Arc<AppState>,
) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let updated = repo_impl::set_datacard_favorite(state, &profile_id, &input)?;
    security_service::persist_active_vault(state)?;
    Ok(updated)
}
