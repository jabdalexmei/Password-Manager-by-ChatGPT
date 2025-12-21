use crate::data::profiles::paths::ensure_profile_dirs;
use crate::data::profiles::registry;
use crate::data::settings::config;
use crate::data::sqlite::init::init_database;
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use crate::services::settings_service::get_settings;
use crate::types::{ProfileMeta, ProfilesList};

pub fn list_profiles(sp: &StoragePaths) -> Result<ProfilesList> {
    let profiles = registry::list_profiles(sp)?;
    Ok(ProfilesList { profiles })
}

pub fn create_profile(sp: &StoragePaths, name: &str, password: Option<String>) -> Result<ProfileMeta> {
    if name.trim().is_empty() {
        return Err(ErrorCodeString::new("PROFILE_NAME_REQUIRED"));
    }
    let profile = registry::create_profile(sp, name, password)?;
    ensure_profile_dirs(sp, &profile.id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    init_database(sp, &profile.id)?;
    let _ = get_settings(sp, &profile.id)?;
    Ok(profile)
}

pub fn delete_profile(sp: &StoragePaths, id: &str) -> Result<bool> {
    registry::delete_profile(sp, id)
}

pub fn get_active_profile(sp: &StoragePaths) -> Result<Option<ProfileMeta>> {
    let settings = config::load_settings(sp)?;
    if let Some(id) = settings.active_profile {
        if let Some(record) = registry::get_profile(sp, &id)? {
            return Ok(Some(record.into()));
        }
    }
    Ok(None)
}

pub fn set_active_profile(sp: &StoragePaths, id: &str) -> Result<bool> {
    let mut settings = config::load_settings(sp)?;
    settings.active_profile = Some(id.to_string());
    config::save_settings(sp, &settings)?;
    Ok(true)
}
