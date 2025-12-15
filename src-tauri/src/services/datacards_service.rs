use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::settings_service::get_settings;
use crate::types::{CreateDataCardInput, DataCard, MoveDataCardInput, UpdateDataCardInput};

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

pub fn list_datacards(state: &State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    let profile_id = require_logged_in(state)?;
    let settings = get_settings(&profile_id)?;
    repo_impl::list_datacards(
        &profile_id,
        false,
        &settings.default_sort_field,
        &settings.default_sort_direction,
    )
}

pub fn get_datacard(id: String, state: &State<Arc<AppState>>) -> Result<DataCard> {
    let profile_id = require_logged_in(state)?;
    repo_impl::get_datacard(&profile_id, &id)
}

pub fn create_datacard(
    input: CreateDataCardInput,
    state: &State<Arc<AppState>>,
) -> Result<DataCard> {
    let profile_id = require_logged_in(state)?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ErrorCodeString::new("DATACARD_TITLE_REQUIRED"));
    }

    let mut sanitized = input;
    sanitized.title = title.to_string();
    sanitized.tags = normalize_tags(sanitized.tags);

    repo_impl::create_datacard(&profile_id, &sanitized)
}

pub fn update_datacard(input: UpdateDataCardInput, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ErrorCodeString::new("DATACARD_TITLE_REQUIRED"));
    }

    let mut sanitized = input;
    sanitized.title = title.to_string();
    sanitized.tags = normalize_tags(sanitized.tags);

    repo_impl::update_datacard(&profile_id, &sanitized)
}

pub fn move_datacard_to_folder(
    input: MoveDataCardInput,
    state: &State<Arc<AppState>>,
) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::move_datacard(&profile_id, &input.id, &input.folder_id)
}

pub fn delete_datacard(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    let settings = get_settings(&profile_id)?;
    if settings.soft_delete_enabled {
        repo_impl::soft_delete_datacard(&profile_id, &id)
    } else {
        repo_impl::purge_datacard(&profile_id, &id)
    }
}

pub fn list_deleted_datacards(state: &State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    let profile_id = require_logged_in(state)?;
    repo_impl::list_deleted_datacards(&profile_id)
}

pub fn restore_datacard(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::restore_datacard(&profile_id, &id)
}

pub fn purge_datacard(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::purge_datacard(&profile_id, &id)
}
