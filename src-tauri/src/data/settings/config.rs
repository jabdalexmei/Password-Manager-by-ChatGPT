use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::data::profiles::paths::ensure_profiles_dir;
use crate::error::{ErrorCodeString, Result};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct UserSettings {
    pub active_profile: Option<String>,
}

fn settings_path() -> Result<PathBuf> {
    ensure_profiles_dir()
        .map(|dir| dir.join("user_settings.json"))
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_UNAVAILABLE"))
}

pub fn load_settings() -> Result<UserSettings> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(UserSettings::default());
    }
    let content = fs::read_to_string(path).map_err(|_| ErrorCodeString::new("SETTINGS_READ"))?;
    serde_json::from_str(&content).map_err(|_| ErrorCodeString::new("SETTINGS_PARSE"))
}

pub fn save_settings(settings: &UserSettings) -> Result<()> {
    let serialized = serde_json::to_string_pretty(settings)
        .map_err(|_| ErrorCodeString::new("SETTINGS_WRITE"))?;
    fs::write(settings_path()?, serialized).map_err(|_| ErrorCodeString::new("SETTINGS_WRITE"))
}
