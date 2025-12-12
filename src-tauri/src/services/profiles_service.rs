use crate::data::profiles::registry;
use crate::data::settings::config;
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
    registry::create_profile(name, password)
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
