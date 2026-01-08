use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::data::fs::atomic_write::write_atomic;
use crate::error::{ErrorCodeString, Result};

const IPC_INFO_FILE: &str = "native-host.json";

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
