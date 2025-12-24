use std::fs;
use std::path::PathBuf;

use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

pub fn profiles_root(sp: &StoragePaths) -> Result<PathBuf> {
    Ok(sp.profiles_root()?.to_path_buf())
}

pub fn ensure_profiles_dir(sp: &StoragePaths) -> Result<PathBuf> {
    let dir = profiles_root(sp)?;
    std::fs::create_dir_all(&dir)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    Ok(dir)
}

pub fn profile_dir(sp: &StoragePaths, id: &str) -> Result<PathBuf> {
    Ok(profiles_root(sp)?.join(id))
}

pub fn vault_db_path(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("vault.db"))
}

pub fn kdf_salt_path(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("kdf_salt.bin"))
}

pub fn key_check_path(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("key_check.bin"))
}

pub fn attachment_file_path(
    sp: &StoragePaths,
    profile_id: &str,
    attachment_id: &str,
) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?
        .join("attachments")
        .join(format!("{attachment_id}.bin")))
}

pub fn attachments_preview_root(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("tmp").join("attachments"))
}

pub fn attachment_preview_path(
    sp: &StoragePaths,
    profile_id: &str,
    attachment_id: &str,
    file_name: &str,
) -> Result<PathBuf> {
    Ok(attachments_preview_root(sp, profile_id)?
        .join(attachment_id)
        .join(file_name))
}

pub fn user_settings_path(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("user_settings.json"))
}

pub fn registry_path(sp: &StoragePaths) -> Result<PathBuf> {
    Ok(profiles_root(sp)?.join("registry.json"))
}

pub fn profile_config_path(sp: &StoragePaths, id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, id)?.join("config.json"))
}

pub fn ensure_profile_dirs(sp: &StoragePaths, profile_id: &str) -> Result<()> {
    let root = profile_dir(sp, profile_id)?;
    fs::create_dir_all(root.join("attachments"))
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    fs::create_dir_all(root.join("backups"))
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    fs::create_dir_all(root.join("tmp").join("attachments"))
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    Ok(())
}
