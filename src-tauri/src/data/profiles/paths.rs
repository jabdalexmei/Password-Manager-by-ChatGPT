use std::path::PathBuf;

use crate::data::storage_paths::StoragePaths;
use std::fs;

pub fn profiles_root(sp: &StoragePaths) -> PathBuf {
    sp.profiles_root().to_path_buf()
}

pub fn ensure_profiles_dir(sp: &StoragePaths) -> std::io::Result<PathBuf> {
    let dir = profiles_root(sp);
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn profile_dir(sp: &StoragePaths, id: &str) -> PathBuf {
    profiles_root(sp).join(id)
}

pub fn vault_db_path(sp: &StoragePaths, profile_id: &str) -> PathBuf {
    profile_dir(sp, profile_id).join("vault.db")
}

pub fn kdf_salt_path(sp: &StoragePaths, profile_id: &str) -> PathBuf {
    profile_dir(sp, profile_id).join("kdf_salt.bin")
}

pub fn key_check_path(sp: &StoragePaths, profile_id: &str) -> PathBuf {
    profile_dir(sp, profile_id).join("key_check.bin")
}

pub fn attachment_file_path(sp: &StoragePaths, profile_id: &str, attachment_id: &str) -> PathBuf {
    profile_dir(sp, profile_id)
        .join("attachments")
        .join(format!("{attachment_id}.bin"))
}

pub fn user_settings_path(sp: &StoragePaths, profile_id: &str) -> PathBuf {
    profile_dir(sp, profile_id).join("user_settings.json")
}

pub fn registry_path(sp: &StoragePaths) -> PathBuf {
    profiles_root(sp).join("registry.json")
}

pub fn profile_config_path(sp: &StoragePaths, id: &str) -> PathBuf {
    profile_dir(sp, id).join("config.json")
}

pub fn ensure_profile_dirs(sp: &StoragePaths, profile_id: &str) -> std::io::Result<()> {
    let root = profile_dir(sp, profile_id);
    fs::create_dir_all(root.join("attachments"))?;
    fs::create_dir_all(root.join("backups"))?;
    Ok(())
}
