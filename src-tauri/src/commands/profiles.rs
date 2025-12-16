use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::profiles_service;
use crate::types::{ProfileMeta, ProfilesList};

#[tauri::command]
pub async fn profiles_list() -> Result<ProfilesList> {
    tauri::async_runtime::spawn_blocking(profiles_service::list_profiles)
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn profile_create(name: String, password: Option<String>) -> Result<ProfileMeta> {
    tauri::async_runtime::spawn_blocking(move || profiles_service::create_profile(&name, password))
        .await
        .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn profile_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app_state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(mut active) = app_state.active_profile.lock() {
            if active.as_deref() == Some(&id) {
                *active = None;
            }
        }
        profiles_service::delete_profile(&id)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn get_active_profile(state: State<'_, Arc<AppState>>) -> Result<Option<ProfileMeta>> {
    let app_state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(active) = app_state.active_profile.lock() {
            if let Some(id) = &*active {
                return profiles_service::get_active_profile()
                    .map(|opt| opt.and_then(|p| if p.id == *id { Some(p) } else { None }));
            }
        }
        profiles_service::get_active_profile()
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn set_active_profile(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
    let app_state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        if !profiles_service::list_profiles()?
            .profiles
            .iter()
            .any(|p| p.id == id)
        {
            return Err(ErrorCodeString::new("PROFILE_NOT_FOUND"));
        }

        if let Ok(mut active) = app_state.active_profile.lock() {
            *active = Some(id.clone());
        }
        profiles_service::set_active_profile(&id)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
