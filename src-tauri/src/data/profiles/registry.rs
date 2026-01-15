use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use uuid::Uuid;

use crate::data::crypto::cipher::PM_ENC_MAGIC;
use crate::data::fs::atomic_write::write_atomic;
use crate::data::profiles::paths::{
    ensure_profiles_dir, key_check_path, kdf_salt_path, profile_config_path, registry_path,
    vault_db_path,
};
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use crate::types::ProfileMeta;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileRecord {
    pub id: String,
    pub name: String,
    pub has_password: bool,
}

impl From<ProfileRecord> for ProfileMeta {
    fn from(value: ProfileRecord) -> Self {
        ProfileMeta {
            id: value.id,
            name: value.name,
            has_password: value.has_password,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ProfileRegistry {
    pub profiles: Vec<ProfileRecord>,
}

fn load_registry(sp: &StoragePaths) -> Result<ProfileRegistry> {
    ensure_profiles_dir(sp)?;
    let path = registry_path(sp)?;
    if !path.exists() {
        return Ok(ProfileRegistry::default());
    }
    let content =
        fs::read_to_string(path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    serde_json::from_str(&content).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_PARSE"))
}

fn save_registry(sp: &StoragePaths, registry: &ProfileRegistry) -> Result<()> {
    ensure_profiles_dir(sp)?;
    let path = registry_path(sp)?;
    let serialized = serde_json::to_string_pretty(registry)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    write_atomic(&path, serialized.as_bytes())
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

fn vault_looks_encrypted(sp: &StoragePaths, id: &str) -> bool {
    let path = match vault_db_path(sp, id) {
        Ok(p) => p,
        Err(_) => return false,
    };
    if !path.exists() {
        return false;
    }
    let mut f = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut buf = [0u8; 6];
    if f.read_exact(&mut buf).is_err() {
        return false;
    }
    buf == PM_ENC_MAGIC
}

fn infer_has_password(sp: &StoragePaths, id: &str, record_has_password: bool) -> bool {
    if record_has_password {
        return true;
    }
    let salt_ok = kdf_salt_path(sp, id).ok().is_some_and(|p| p.exists());
    let key_ok = key_check_path(sp, id).ok().is_some_and(|p| p.exists());
    if salt_ok && key_ok {
        return true;
    }
    vault_looks_encrypted(sp, id)
}

pub fn list_profiles(sp: &StoragePaths) -> Result<Vec<ProfileMeta>> {
    let mut registry = load_registry(sp)?;
    let mut dirty = false;

    for rec in registry.profiles.iter_mut() {
        let inferred = infer_has_password(sp, &rec.id, rec.has_password);
        if inferred != rec.has_password {
            rec.has_password = inferred;
            dirty = true;
        }
    }

    if dirty {
        // Best-effort self-heal; even if it fails, we still return inferred values.
        let _ = save_registry(sp, &registry);
    }

    Ok(registry.profiles.into_iter().map(ProfileMeta::from).collect())
}

pub fn create_profile(
    sp: &StoragePaths,
    name: &str,
    password: Option<String>,
) -> Result<ProfileMeta> {
    ensure_profiles_dir(sp)?;
    let id = Uuid::new_v4().to_string();
    let has_password = password.as_ref().map(|p| !p.is_empty()).unwrap_or(false);

    let record = ProfileRecord {
        id: id.clone(),
        name: name.to_string(),
        has_password,
    };

    let profile_dir = crate::data::profiles::paths::profile_dir(sp, &id)?;
    crate::data::profiles::paths::ensure_profile_dirs(sp, &id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let config_path: PathBuf = profile_config_path(sp, &id)?;
    let config = serde_json::json!({ "name": name });
    let serialized_config = serde_json::to_string_pretty(&config)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    if write_atomic(&config_path, serialized_config.as_bytes()).is_err() {
        let _ = fs::remove_dir_all(&profile_dir);
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }

    let mut registry = match load_registry(sp) {
        Ok(registry) => registry,
        Err(err) => {
            let _ = fs::remove_dir_all(&profile_dir);
            return Err(err);
        }
    };
    registry.profiles.push(record.clone());
    if let Err(err) = save_registry(sp, &registry) {
        let _ = fs::remove_dir_all(&profile_dir);
        return Err(err);
    }

    Ok(record.into())
}

/// Create (or update) a profile record using a caller-provided profile_id.
/// This is used by restore-from-backup: encrypted data is bound to profile_id via AEAD AAD,
/// so we must recreate the same id to be able to decrypt restored vault/attachments.
pub fn upsert_profile_with_id(
    sp: &StoragePaths,
    id: &str,
    name: &str,
    has_password: bool,
) -> Result<ProfileMeta> {
    ensure_profiles_dir(sp)?;

    // Ensure profile dirs exist (id is used as folder name).
    let profile_dir = crate::data::profiles::paths::profile_dir(sp, id)?;
    let existed_before = profile_dir.exists();
    crate::data::profiles::paths::ensure_profile_dirs(sp, id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    // Write config.json with the name (keeps UI consistent).
    let config_path: PathBuf = profile_config_path(sp, id)?;
    let config = serde_json::json!({ "name": name });
    let serialized_config = serde_json::to_string_pretty(&config)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    if write_atomic(&config_path, serialized_config.as_bytes()).is_err() {
        // Never delete an existing profile directory on config write failure.
        if !existed_before && profile_dir.exists() {
            let _ = fs::remove_dir_all(&profile_dir);
        }
        return Err(ErrorCodeString::new("PROFILE_STORAGE_WRITE"));
    }

    let mut registry = load_registry(sp)?;
    if let Some(existing) = registry.profiles.iter_mut().find(|p| p.id == id) {
        existing.name = name.to_string();
        existing.has_password = has_password;
        save_registry(sp, &registry)?;
        return Ok(ProfileMeta {
            id: id.to_string(),
            name: name.to_string(),
            has_password,
        });
    }

    registry.profiles.push(ProfileRecord {
        id: id.to_string(),
        name: name.to_string(),
        has_password,
    });
    save_registry(sp, &registry)?;

    Ok(ProfileMeta {
        id: id.to_string(),
        name: name.to_string(),
        has_password,
    })
}

pub fn rename_profile(sp: &StoragePaths, id: &str, name: &str) -> Result<ProfileMeta> {
    ensure_profiles_dir(sp)?;
    let mut registry = load_registry(sp)?;
    let idx = registry
        .profiles
        .iter()
        .position(|p| p.id == id)
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;

    registry.profiles[idx].name = name.to_string();

    let meta = ProfileMeta {
        id: registry.profiles[idx].id.clone(),
        name: registry.profiles[idx].name.clone(),
        has_password: infer_has_password(
            sp,
            &registry.profiles[idx].id,
            registry.profiles[idx].has_password,
        ),
    };

    save_registry(sp, &registry)?;

    let config_path: PathBuf = profile_config_path(sp, id)?;
    let config = serde_json::json!({ "name": name });
    let serialized_config = serde_json::to_string_pretty(&config)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    write_atomic(&config_path, serialized_config.as_bytes())
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    Ok(meta)
}

pub fn delete_profile(sp: &StoragePaths, id: &str) -> Result<bool> {
    ensure_profiles_dir(sp)?;
    let mut registry = load_registry(sp)?;
    let original_len = registry.profiles.len();
    registry.profiles.retain(|p| p.id != id);
    if registry.profiles.len() == original_len {
        return Err(ErrorCodeString::new("PROFILE_NOT_FOUND"));
    }
    save_registry(sp, &registry)?;
    let dir = crate::data::profiles::paths::profile_dir(sp, id)?;
    if dir.exists() {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(true)
}

pub fn get_profile(sp: &StoragePaths, id: &str) -> Result<Option<ProfileRecord>> {
    let mut registry = load_registry(sp)?;
    let mut dirty = false;

    if let Some(rec) = registry.profiles.iter_mut().find(|p| p.id == id) {
        let inferred = infer_has_password(sp, &rec.id, rec.has_password);
        if inferred != rec.has_password {
            rec.has_password = inferred;
            dirty = true;
        }

        if dirty {
            let _ = save_registry(sp, &registry);
        }

        return Ok(Some(rec.clone()));
    }

    Ok(None)
}
