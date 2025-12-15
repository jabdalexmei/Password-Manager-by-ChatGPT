use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::settings_service::get_settings;
use crate::types::{
    CreateDataCardInput, DataCard, MoveDataCardInput, UpdateDataCardInput,
};

fn require_logged_in(state: &State<Arc<AppState>>) -> Result<String> {
    state
        .logged_in_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone()
        .ok_or_else(|| ErrorCodeString::new("VAULT_LOCKED"))
}

fn sort_clause(settings: &crate::types::UserSettings) -> String {
    format!(
        "{} {}",
        settings.default_sort_field, settings.default_sort_direction
    )
}

pub fn list_datacards(state: &State<Arc<AppState>>) -> Result<Vec<DataCard>> {
    let profile_id = require_logged_in(state)?;
    let settings = get_settings(&profile_id)?;
    repo_impl::list_datacards(&profile_id, false, &sort_clause(&settings))
}

pub fn get_datacard(id: String, state: &State<Arc<AppState>>) -> Result<DataCard> {
    let profile_id = require_logged_in(state)?;
    repo_impl::get_datacard(&profile_id, &id)
}

pub fn create_datacard(input: CreateDataCardInput, state: &State<Arc<AppState>>) -> Result<DataCard> {
    let profile_id = require_logged_in(state)?;
    repo_impl::create_datacard(
        &profile_id,
        &input.title,
        &input.username,
        &input.password,
        &input.url,
        &input.notes,
        &input.folder_id,
    )
}

pub fn update_datacard(input: UpdateDataCardInput, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::update_datacard(
        &profile_id,
        &input.id,
        &input.title,
        &input.username,
        &input.password,
        &input.url,
        &input.notes,
        &input.folder_id,
    )
}

pub fn move_datacard(input: MoveDataCardInput, state: &State<Arc<AppState>>) -> Result<bool> {
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
    let settings = get_settings(&profile_id)?;
    let mut cards = repo_impl::list_datacards(&profile_id, true, &sort_clause(&settings))?;
    cards.retain(|c| c.deleted_at.is_some());
    Ok(cards)
}

pub fn restore_datacard(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::restore_datacard(&profile_id, &id)
}

pub fn purge_datacard(id: String, state: &State<Arc<AppState>>) -> Result<bool> {
    let profile_id = require_logged_in(state)?;
    repo_impl::purge_datacard(&profile_id, &id)
}
