use chrono::Utc;
use std::sync::Arc;

use crate::app_state::AppState;
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::services::security_service;

const PREF_KEY_DATACARD_PREVIEW_FIELDS: &str = "datacard.preview_fields";
const PREF_KEY_DATACARD_CORE_HIDDEN_FIELDS: &str = "datacard.core_hidden_fields";
const MAX_PREVIEW_FIELDS: usize = 3;
const MAX_CORE_HIDDEN_FIELDS: usize = 3;

fn is_allowed_preview_field(value: &str) -> bool {
    matches!(
        value,
        "username" | "recovery_email" | "mobile_phone" | "note" | "folder" | "tags"
    )
}

fn is_allowed_core_field(value: &str) -> bool {
    matches!(value, "title" | "url" | "email")
}

fn normalize_preview_fields(input: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in input {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !is_allowed_preview_field(trimmed) {
            continue;
        }
        if out.iter().any(|v| v == trimmed) {
            continue;
        }
        out.push(trimmed.to_string());
        if out.len() >= MAX_PREVIEW_FIELDS {
            break;
        }
    }
    out
}

fn normalize_core_hidden_fields(input: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in input {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !is_allowed_core_field(trimmed) {
            continue;
        }
        if out.iter().any(|v| v == trimmed) {
            continue;
        }
        out.push(trimmed.to_string());
        if out.len() >= MAX_CORE_HIDDEN_FIELDS {
            break;
        }
    }
    out
}

pub fn get_datacard_preview_fields(state: &Arc<AppState>) -> Result<Vec<String>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;

    let raw =
        repo_impl::get_ui_preference_value_json(state, &profile_id, PREF_KEY_DATACARD_PREVIEW_FIELDS)?;
    if let Some(value_json) = raw {
        let parsed: Result<Vec<String>> =
            serde_json::from_str(&value_json).map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"));
        if let Ok(v) = parsed {
            return Ok(normalize_preview_fields(v));
        }
    }

    Ok(Vec::new())
}

pub fn set_datacard_preview_fields(fields: Vec<String>, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;

    let cleaned = normalize_preview_fields(fields);
    let value_json =
        serde_json::to_string(&cleaned).map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let now_utc = Utc::now().to_rfc3339();
    repo_impl::set_ui_preference_value_json(
        state,
        &profile_id,
        PREF_KEY_DATACARD_PREVIEW_FIELDS,
        &value_json,
        &now_utc,
    )
}

pub fn get_datacard_core_hidden_fields(state: &Arc<AppState>) -> Result<Vec<String>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;

    let raw = repo_impl::get_ui_preference_value_json(
        state,
        &profile_id,
        PREF_KEY_DATACARD_CORE_HIDDEN_FIELDS,
    )?;
    if let Some(value_json) = raw {
        let parsed: Result<Vec<String>> =
            serde_json::from_str(&value_json).map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"));
        if let Ok(v) = parsed {
            return Ok(normalize_core_hidden_fields(v));
        }
    }

    Ok(Vec::new())
}

pub fn set_datacard_core_hidden_fields(fields: Vec<String>, state: &Arc<AppState>) -> Result<bool> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;

    let cleaned = normalize_core_hidden_fields(fields);
    let value_json =
        serde_json::to_string(&cleaned).map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let now_utc = Utc::now().to_rfc3339();
    repo_impl::set_ui_preference_value_json(
        state,
        &profile_id,
        PREF_KEY_DATACARD_CORE_HIDDEN_FIELDS,
        &value_json,
        &now_utc,
    )
}
