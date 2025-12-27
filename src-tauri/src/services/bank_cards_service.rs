use chrono::Utc;
use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::security_service;
use crate::services::settings_service::get_settings;
use crate::types::{
    BankCardItem, BankCardSummary, CreateBankCardInput, SetBankCardFavoriteInput,
    UpdateBankCardInput,
};

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

pub fn list_bank_cards_summary(state: &Arc<AppState>) -> Result<Vec<BankCardSummary>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let storage_paths = state.get_storage_paths()?;
    let settings = get_settings(&storage_paths, &profile_id)?;
    repo_impl::list_bank_cards_summary(
        state,
        &profile_id,
        &settings.default_sort_field,
        &settings.default_sort_direction,
    )
}

pub fn list_deleted_bank_cards_summary(state: &Arc<AppState>) -> Result<Vec<BankCardSummary>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    repo_impl::list_deleted_bank_cards_summary(state, &profile_id)
}

pub fn get_bank_card(id: String, state: &Arc<AppState>) -> Result<BankCardItem> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    repo_impl::get_bank_card(state, &profile_id, &id)
}

pub fn create_bank_card(input: CreateBankCardInput, state: &Arc<AppState>) -> Result<BankCardItem> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let mut sanitized = input;
    sanitized.title = sanitized.title.trim().to_string();
    if sanitized.title.is_empty() {
        return Err(ErrorCodeString::new("VALIDATION_ERROR"));
    }
    sanitized.tags = normalize_tags(sanitized.tags);

    let created = repo_impl::create_bank_card(state, &profile_id, &sanitized)?;
    security_service::persist_active_vault(state)?;
    Ok(created)
}

pub fn update_bank_card(input: UpdateBankCardInput, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let mut sanitized = input;
    sanitized.title = sanitized.title.trim().to_string();
    if sanitized.title.is_empty() {
        return Err(ErrorCodeString::new("VALIDATION_ERROR"));
    }
    sanitized.tags = normalize_tags(sanitized.tags);

    let updated = repo_impl::update_bank_card(state, &profile_id, &sanitized)?;
    security_service::persist_active_vault(state)?;
    Ok(updated)
}

pub fn delete_bank_card(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let storage_paths = state.get_storage_paths()?;
    let settings = get_settings(&storage_paths, &profile_id)?;
    if settings.soft_delete_enabled {
        let now = Utc::now().to_rfc3339();
        repo_impl::soft_delete_bank_card(state, &profile_id, &id, &now)?;
        security_service::persist_active_vault(state)?;
        Ok(true)
    } else {
        purge_bank_card_internal(state, &profile_id, &id)
    }
}

pub fn restore_bank_card(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    repo_impl::restore_bank_card(state, &profile_id, &id)?;
    security_service::persist_active_vault(state)?;
    Ok(true)
}

pub fn purge_bank_card(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    purge_bank_card_internal(state, &profile_id, &id)
}

fn purge_bank_card_internal(state: &Arc<AppState>, profile_id: &str, id: &str) -> Result<bool> {
    let purged = repo_impl::purge_bank_card(state, profile_id, id)?;
    security_service::persist_active_vault(state)?;
    Ok(purged)
}

pub fn set_bank_card_favorite(
    input: SetBankCardFavoriteInput,
    state: &Arc<AppState>,
) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let updated = repo_impl::set_bank_card_favorite(state, &profile_id, &input)?;
    security_service::persist_active_vault(state)?;
    Ok(updated)
}
