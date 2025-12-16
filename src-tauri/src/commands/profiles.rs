use std::sync::Arc;

use tauri::State;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::services::profiles_service;
use crate::types::{ProfileMeta, ProfilesList};

#[tauri::command]
pub fn profiles_list() -> Result<ProfilesList> {
    profiles_service::list_profiles()
}

#[tauri::command]
pub fn profile_create(name: String, password: Option<String>) -> Result<ProfileMeta> {
    profiles_service::create_profile(&name, password)
}

#[tauri::command]
pub fn profile_delete(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    if let Ok(mut active) = state.active_profile.lock() {
        if active.as_deref() == Some(&id) {
            *active = None;
        }
    }
    profiles_service::delete_profile(&id)
}

#[tauri::command]
pub fn get_active_profile(state: State<Arc<AppState>>) -> Result<Option<ProfileMeta>> {
    if let Ok(active) = state.active_profile.lock() {
        if let Some(id) = &*active {
            return profiles_service::get_active_profile()
                .map(|opt| opt.and_then(|p| if p.id == *id { Some(p) } else { None }));
        }
    }
    profiles_service::get_active_profile()
}

#[tauri::command]
pub fn set_active_profile(id: String, state: State<Arc<AppState>>) -> Result<bool> {
    if !profiles_service::list_profiles()?
        .profiles
        .iter()
        .any(|p| p.id == id)
    {
        return Err(ErrorCodeString::new("PROFILE_NOT_FOUND"));
    }
    if let Ok(mut active) = state.active_profile.lock() {
        *active = Some(id.clone());
    }
    profiles_service::set_active_profile(&id)
}
