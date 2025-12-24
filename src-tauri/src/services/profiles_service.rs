use crate::data::crypto::kdf::{derive_master_key, generate_kdf_salt};
use crate::data::crypto::key_check;
use crate::data::profiles::paths::{ensure_profile_dirs, kdf_salt_path};
use crate::data::profiles::registry;
use crate::data::settings::config;
use crate::data::sqlite::init::{init_database_passwordless, init_database_protected_encrypted};
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use crate::services::settings_service::get_settings;
use crate::types::{ProfileMeta, ProfilesList};
use std::fs;
use zeroize::Zeroizing;

pub fn list_profiles(sp: &StoragePaths) -> Result<ProfilesList> {
    let profiles = registry::list_profiles(sp)?;
    Ok(ProfilesList { profiles })
}

pub fn create_profile(
    sp: &StoragePaths,
    name: &str,
    password: Option<String>,
) -> Result<ProfileMeta> {
    if name.trim().is_empty() {
        return Err(ErrorCodeString::new("PROFILE_NAME_REQUIRED"));
    }
    let profile = registry::create_profile(sp, name, password.clone())?;
    ensure_profile_dirs(sp, &profile.id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let is_passwordless = password.as_ref().map(|p| p.is_empty()).unwrap_or(true);
    if is_passwordless {
        init_database_passwordless(sp, &profile.id)?;
    } else {
        let salt = generate_kdf_salt();
        fs::write(kdf_salt_path(sp, &profile.id)?, &salt)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        let pwd = password.unwrap_or_default();
        let key = Zeroizing::new(derive_master_key(&pwd, &salt)?);
        key_check::create_key_check_file(sp, &profile.id, &key)?;
        init_database_protected_encrypted(sp, &profile.id, &key)?;
    }

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
