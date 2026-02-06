use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::security_service;
use crate::services::settings_service;
use crate::types::Vault;

pub fn list_vaults(state: &Arc<AppState>) -> Result<Vec<Vault>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    repo_impl::list_vaults(state, &profile_id)
}

pub fn create_vault(name: String, state: &Arc<AppState>) -> Result<Vault> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let storage_paths = state.get_storage_paths()?;
    let settings = settings_service::get_settings(&storage_paths, &profile_id)?;
    if !settings.multiply_vaults_enabled {
        return Err(ErrorCodeString::new("MULTIPLY_VAULTS_DISABLED"));
    }

    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(ErrorCodeString::new("VAULT_NAME_REQUIRED"));
    }

    let created = repo_impl::create_vault(state, &profile_id, trimmed)?;
    security_service::request_persist_active_vault(state.clone());
    Ok(created)
}

pub fn set_active_vault(id: String, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let storage_paths = state.get_storage_paths()?;
    let mut settings = settings_service::get_settings(&storage_paths, &profile_id)?;

    let normalized = settings_service::normalize_active_vault_id(&id);
    if !settings.multiply_vaults_enabled && normalized != settings_service::DEFAULT_VAULT_ID {
        return Err(ErrorCodeString::new("MULTIPLY_VAULTS_DISABLED"));
    }

    let _ = repo_impl::get_vault(state, &profile_id, &normalized)?;

    if let Ok(mut active_vault_id) = state.active_vault_id.lock() {
        *active_vault_id = Some(normalized.clone());
    }

    settings.active_vault_id = normalized;
    let updated = settings_service::update_settings(&storage_paths, settings, &profile_id)?;
    if updated {
        security_service::request_persist_active_vault(state.clone());
    }
    Ok(updated)
}
