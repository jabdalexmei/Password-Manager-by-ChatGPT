use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::data::fs::atomic_write::write_atomic;
use crate::error::{ErrorCodeString, Result};

const IPC_INFO_FILE: &str = "native-host.json";
const IPC_INFO_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NativeHostIpcInfo {
    pub schema_version: u8,
    pub port: u16,
    pub token: String,
    pub created_at_ms: u128,
}

fn primary_ipc_info_path(app_dir: &Path) -> PathBuf {
    app_dir.join(IPC_INFO_FILE)
}

fn fallback_ipc_info_path() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|dir| dir.join("Password Manager").join(IPC_INFO_FILE))
}

fn is_dir_writable(dir: &Path) -> bool {
    if !dir.exists() {
        return false;
    }
    let test_path = dir.join(format!(".pm-ipc-write-test-{}.tmp", uuid::Uuid::new_v4()));
    if std::fs::write(&test_path, b"test").is_err() {
        return false;
    }
    let _ = std::fs::remove_file(&test_path);
    true
}

fn ipc_info_path_for_load(app_dir: &Path) -> PathBuf {
    let primary = primary_ipc_info_path(app_dir);
    if primary.exists() {
        return primary;
    }
    if !is_dir_writable(app_dir) {
        if let Some(fallback) = fallback_ipc_info_path() {
            if fallback.exists() {
                return fallback;
            }
        }
    }
    primary
}

fn ipc_info_path_for_write(app_dir: &Path) -> Result<PathBuf> {
    if is_dir_writable(app_dir) {
        return Ok(primary_ipc_info_path(app_dir));
    }
    let fallback = fallback_ipc_info_path().ok_or_else(|| ErrorCodeString::new("IPC_INFO_WRITE_FAILED"))?;
    if let Some(parent) = fallback.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|_| ErrorCodeString::new("IPC_INFO_WRITE_FAILED"))?;
    }
    Ok(fallback)
}

pub fn load_ipc_info(app_dir: &Path) -> Result<Option<NativeHostIpcInfo>> {
    let path = ipc_info_path_for_load(app_dir);
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|_| ErrorCodeString::new("IPC_INFO_READ_FAILED"))?;
    let info: NativeHostIpcInfo = serde_json::from_str(&content)
        .map_err(|_| ErrorCodeString::new("IPC_INFO_READ_FAILED"))?;
    if info.schema_version != IPC_INFO_SCHEMA_VERSION {
        return Err(ErrorCodeString::new("IPC_INFO_SCHEMA_MISMATCH"));
    }
    Ok(Some(info))
}

pub fn write_ipc_info(app_dir: &Path, info: &NativeHostIpcInfo) -> Result<PathBuf> {
    let path = ipc_info_path_for_write(app_dir)?;
    let serialized = serde_json::to_string_pretty(info)
        .map_err(|_| ErrorCodeString::new("IPC_INFO_WRITE_FAILED"))?;
    write_atomic(&path, serialized.as_bytes())
        .map_err(|_| ErrorCodeString::new("IPC_INFO_WRITE_FAILED"))?;
    Ok(path)
}

pub fn remove_ipc_info(app_dir: &Path) {
    let primary = primary_ipc_info_path(app_dir);
    let _ = std::fs::remove_file(primary);
    if let Some(fallback) = fallback_ipc_info_path() {
        let _ = std::fs::remove_file(fallback);
    }
}
