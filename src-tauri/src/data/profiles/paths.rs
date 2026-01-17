use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

fn validate_profile_id(id: &str) -> Result<()> {
    if id.trim().is_empty() {
        return Err(ErrorCodeString::new("PROFILE_ID_INVALID"));
    }

    // Profile IDs are used as directory names under the workspace storage.
    // Reject anything that looks like a path (separators, prefixes, parent dirs, etc).
    let p = Path::new(id);
    let mut components = p.components();

    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(()),
        _ => Err(ErrorCodeString::new("PROFILE_ID_INVALID")),
    }
}

#[cfg(unix)]
fn set_dir_private(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
fn set_dir_private(_path: &Path) -> std::io::Result<()> {
    Ok(())
}


pub fn profiles_root(sp: &StoragePaths) -> Result<PathBuf> {
    Ok(sp.profiles_root()?.to_path_buf())
}

pub fn ensure_profiles_dir(sp: &StoragePaths) -> Result<PathBuf> {
    let dir = profiles_root(sp)?;
    std::fs::create_dir_all(&dir)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    set_dir_private(&dir)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    Ok(dir)
}

pub fn profile_dir(sp: &StoragePaths, id: &str) -> Result<PathBuf> {
    validate_profile_id(id)?;
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

pub fn user_settings_path(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("user_settings.json"))
}

pub fn backups_dir(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, profile_id)?.join("backups"))
}

pub fn backup_registry_path(sp: &StoragePaths, profile_id: &str) -> Result<PathBuf> {
    Ok(backups_dir(sp, profile_id)?.join("registry.json"))
}

pub fn registry_path(sp: &StoragePaths) -> Result<PathBuf> {
    Ok(profiles_root(sp)?.join("registry.json"))
}

pub fn profile_config_path(sp: &StoragePaths, id: &str) -> Result<PathBuf> {
    Ok(profile_dir(sp, id)?.join("config.json"))
}

pub fn ensure_profile_dirs(sp: &StoragePaths, profile_id: &str) -> Result<()> {
    let root = profile_dir(sp, profile_id)?;

    fs::create_dir_all(&root)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    set_dir_private(&root)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    for sub in ["attachments", "backups", "tmp"] {
        let dir = root.join(sub);
        fs::create_dir_all(&dir)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
        set_dir_private(&dir)
            .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;
    }
    Ok(())
}
