use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use crate::data::crypto::kdf::{hash_password, verify_password};
use crate::data::profiles::paths::{ensure_profiles_dir, profile_config_path, registry_path};
use crate::error::{ErrorCodeString, Result};
use crate::types::ProfileMeta;

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

fn load_registry() -> Result<ProfileRegistry> {
    ensure_profiles_dir().map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let path = registry_path();
    if !path.exists() {
        return Ok(ProfileRegistry::default());
    }
    let content =
        fs::read_to_string(path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    serde_json::from_str(&content).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_PARSE"))
}

fn save_registry(registry: &ProfileRegistry) -> Result<()> {
    ensure_profiles_dir().map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let path = registry_path();
    let serialized = serde_json::to_string_pretty(registry)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    fs::write(path, serialized).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

pub fn list_profiles() -> Result<Vec<ProfileMeta>> {
    let registry = load_registry()?;
    Ok(registry
        .profiles
        .into_iter()
        .map(ProfileMeta::from)
        .collect())
}

pub fn create_profile(name: &str, password: Option<String>) -> Result<ProfileMeta> {
    ensure_profiles_dir().map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let mut registry = load_registry()?;
    let id = Uuid::new_v4().to_string();
    let password_hash = match password {
        Some(pwd) if !pwd.is_empty() => {
            Some(hash_password(&pwd).map_err(|_| ErrorCodeString::new("PASSWORD_HASH"))?)
        }
        _ => None,
    };

    let record = ProfileRecord {
        id: id.clone(),
        name: name.to_string(),
        password_hash,
    };

    registry.profiles.push(record.clone());
    save_registry(&registry)?;

    let profile_dir = crate::data::profiles::paths::profile_dir(&id);
    fs::create_dir_all(&profile_dir).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let config_path: PathBuf = profile_config_path(&id);
    let config = serde_json::json!({ "name": name });
    fs::write(config_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    Ok(record.into())
}

pub fn delete_profile(id: &str) -> Result<bool> {
    ensure_profiles_dir().map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let mut registry = load_registry()?;
    registry.profiles.retain(|p| p.id != id);
    save_registry(&registry)?;
    let dir = crate::data::profiles::paths::profile_dir(id);
    if dir.exists() {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(true)
}

pub fn get_profile(id: &str) -> Result<Option<ProfileRecord>> {
    let registry = load_registry()?;
    Ok(registry.profiles.into_iter().find(|p| p.id == id))
}

pub fn verify_profile_password(id: &str, password: &str) -> Result<bool> {
    let record = get_profile(id)?.ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;
    if let Some(hash) = record.password_hash {
        Ok(verify_password(password, &hash))
    } else {
        Ok(true)
    }
}
