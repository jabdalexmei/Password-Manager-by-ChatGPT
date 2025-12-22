use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use crate::data::crypto::kdf::{derive_master_key, hash_password};
use crate::data::crypto::key_check;
use crate::data::profiles::paths::{
    ensure_profiles_dir, kdf_salt_path, profile_config_path, registry_path,
};
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use crate::types::ProfileMeta;
use zeroize::Zeroizing;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileRecord {
    pub id: String,
    pub name: String,
    pub password_hash: Option<String>,
}

impl From<ProfileRecord> for ProfileMeta {
    fn from(value: ProfileRecord) -> Self {
        ProfileMeta {
            id: value.id,
            name: value.name,
            has_password: value.password_hash.is_some(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ProfileRegistry {
    pub profiles: Vec<ProfileRecord>,
}

fn load_registry(sp: &StoragePaths) -> Result<ProfileRegistry> {
    ensure_profiles_dir(sp).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let path = registry_path(sp);
    if !path.exists() {
        return Ok(ProfileRegistry::default());
    }
    let content =
        fs::read_to_string(path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    serde_json::from_str(&content).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_PARSE"))
}

fn save_registry(sp: &StoragePaths, registry: &ProfileRegistry) -> Result<()> {
    ensure_profiles_dir(sp).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let path = registry_path(sp);
    let serialized = serde_json::to_string_pretty(registry)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    fs::write(path, serialized).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

pub fn list_profiles(sp: &StoragePaths) -> Result<Vec<ProfileMeta>> {
    let registry = load_registry(sp)?;
    Ok(registry
        .profiles
        .into_iter()
        .map(ProfileMeta::from)
        .collect())
}

pub fn create_profile(
    sp: &StoragePaths,
    name: &str,
    password: Option<String>,
) -> Result<ProfileMeta> {
    ensure_profiles_dir(sp).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let mut registry = load_registry(sp)?;
    let id = Uuid::new_v4().to_string();
    let password_hash = match password {
        Some(pwd) if !pwd.is_empty() => Some(hash_password(&pwd)?),
        _ => None,
    };

    let record = ProfileRecord {
        id: id.clone(),
        name: name.to_string(),
        password_hash,
    };

    registry.profiles.push(record.clone());
    save_registry(sp, &registry)?;

    let profile_dir = crate::data::profiles::paths::profile_dir(sp, &id);
    fs::create_dir_all(&profile_dir).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let config_path: PathBuf = profile_config_path(sp, &id);
    let config = serde_json::json!({ "name": name });
    fs::write(config_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    Ok(record.into())
}

pub fn delete_profile(sp: &StoragePaths, id: &str) -> Result<bool> {
    ensure_profiles_dir(sp).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let mut registry = load_registry(sp)?;
    registry.profiles.retain(|p| p.id != id);
    save_registry(sp, &registry)?;
    let dir = crate::data::profiles::paths::profile_dir(sp, id);
    if dir.exists() {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(true)
}

pub fn get_profile(sp: &StoragePaths, id: &str) -> Result<Option<ProfileRecord>> {
    let registry = load_registry(sp)?;
    Ok(registry.profiles.into_iter().find(|p| p.id == id))
}

pub fn verify_profile_password(sp: &StoragePaths, id: &str, password: &str) -> Result<bool> {
    let record = get_profile(sp, id)?.ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;
    if record.password_hash.is_none() {
        return Ok(true);
    }

    let salt_path = kdf_salt_path(sp, id);
    if !salt_path.exists() {
        return Err(ErrorCodeString::new("KDF_SALT_MISSING"));
    }
    let salt = fs::read(&salt_path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    let key = Zeroizing::new(derive_master_key(password, &salt)?);
    key_check::verify_key_check_file(sp, id, &key)
}
