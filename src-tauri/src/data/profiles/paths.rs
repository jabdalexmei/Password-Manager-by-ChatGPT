use std::path::{Path, PathBuf};

pub fn profiles_root() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or(std::env::temp_dir())
        .join("NewAppTest")
        .join("profiles")
}

pub fn ensure_profiles_dir() -> std::io::Result<PathBuf> {
    let dir = profiles_root();
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn profile_dir(id: &str) -> PathBuf {
    profiles_root().join(id)
}

pub fn registry_path() -> PathBuf {
    profiles_root().join("registry.json")
}

pub fn active_profile_path() -> PathBuf {
    profiles_root().join("active_profile.json")
}

pub fn profile_config_path(id: &str) -> PathBuf {
    profile_dir(id).join("config.json")
}

pub fn profile_exists(id: &str) -> bool {
    Path::new(&profile_dir(id)).exists()
}
