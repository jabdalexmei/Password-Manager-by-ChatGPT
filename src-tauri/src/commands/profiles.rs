use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::{profiles_service, security_service};
use crate::types::{ProfileMeta, ProfilesList};

#[tauri::command]
pub async fn profiles_list(state: State<'_, Arc<AppState>>) -> Result<ProfilesList> {
    let storage_paths = state.inner().storage_paths.clone();

    tauri::async_runtime::spawn_blocking(move || profiles_service::list_profiles(&storage_paths))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn profile_create(
    name: String,
    password: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<ProfileMeta> {
    let storage_paths = state.inner().storage_paths.clone();

    tauri::async_runtime::spawn_blocking(move || {
        profiles_service::create_profile(&storage_paths, &name, password)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn profile_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app_state = state.inner().clone();
    let storage_paths = app_state.storage_paths.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let should_lock = app_state
            .logged_in_profile
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .as_deref()
            == Some(&id);
        if should_lock {
            security_service::lock_vault(&app_state)?;
        }
        let delete_result = profiles_service::delete_profile(&storage_paths, &id);
        if delete_result.is_ok() {
            if let Ok(mut active) = app_state.active_profile.lock() {
                if active.as_deref() == Some(&id) {
                    *active = None;
                }
            }
        }
        delete_result
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn get_active_profile(state: State<'_, Arc<AppState>>) -> Result<Option<ProfileMeta>> {
    let app_state = state.inner().clone();
    let storage_paths = app_state.storage_paths.clone();

    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(active) = app_state.active_profile.lock() {
            if let Some(id) = &*active {
                return profiles_service::get_active_profile(&storage_paths)
                    .map(|opt| opt.and_then(|p| if p.id == *id { Some(p) } else { None }));
            }
        }
        profiles_service::get_active_profile(&storage_paths)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn set_active_profile(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app_state = state.inner().clone();
    let storage_paths = app_state.storage_paths.clone();

    tauri::async_runtime::spawn_blocking(move || {
        if !profiles_service::list_profiles(&storage_paths)?
            .profiles
            .iter()
            .any(|p| p.id == id)
        {
            return Err(ErrorCodeString::new("PROFILE_NOT_FOUND"));
        }

        let old_active_profile_id = app_state
            .active_profile
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .clone();

        if let Ok(mut active) = app_state.active_profile.lock() {
            *active = Some(id.clone());
        }
        profiles_service::set_active_profile(&storage_paths, &id)?;

        if let Some(old_id) = old_active_profile_id {
            crate::data::sqlite::pool::clear_pool(&old_id);
        }

        Ok(true)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
