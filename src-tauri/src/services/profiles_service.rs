use crate::data::profiles::registry;
use crate::data::settings::config;
use crate::data::sqlite::init::init_database;
use crate::data::profiles::paths::ensure_profile_dirs;
use crate::services::settings_service::get_settings;
use crate::error::{ErrorCodeString, Result};
use crate::types::{ProfileMeta, ProfilesList};

pub fn list_profiles() -> Result<ProfilesList> {
    let profiles = registry::list_profiles()?;
    Ok(ProfilesList { profiles })
}

pub fn create_profile(name: &str, password: Option<String>) -> Result<ProfileMeta> {
    if name.trim().is_empty() {
        return Err(ErrorCodeString::new("PROFILE_NAME_REQUIRED"));
    }
    let profile = registry::create_profile(name, password)?;
    ensure_profile_dirs(&profile.id).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    init_database(&profile.id)?;
    let _ = get_settings(&profile.id)?;
    Ok(profile)
}

pub fn delete_profile(id: &str) -> Result<bool> {
    registry::delete_profile(id)
}

pub fn get_active_profile() -> Result<Option<ProfileMeta>> {
    let settings = config::load_settings()?;
    if let Some(id) = settings.active_profile {
        if let Some(record) = registry::get_profile(&id)? {
            return Ok(Some(record.into()));
        }
    }
    Ok(None)
}

pub fn set_active_profile(id: &str) -> Result<bool> {
    let mut settings = config::load_settings()?;
    settings.active_profile = Some(id.to_string());
    config::save_settings(&settings)?;
    Ok(true)
}
