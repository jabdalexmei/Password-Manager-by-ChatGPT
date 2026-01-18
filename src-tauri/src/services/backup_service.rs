use std::fs;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::app_state::AppState;

// Restore hard limits (anti zip-bomb / decompression bomb DoS)
const MAX_RESTORE_FILES: usize = 4096;
const MAX_RESTORE_ENTRY_BYTES: i64 = 64 * 1024 * 1024;
const MAX_RESTORE_TOTAL_BYTES: i64 = 512 * 1024 * 1024;

use crate::data::fs::atomic_write::write_atomic;
use crate::data::profiles::paths::{
    backup_registry_path, backups_dir, kdf_salt_path, key_check_path, profile_config_path,
    profile_dir, user_settings_path, vault_db_path,
};
use crate::data::profiles::registry;
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use crate::services::{security_service, settings_service};
use crate::types::UserSettings;

#[cfg(windows)]
fn replace_file_windows(src: &Path, dst: &Path) -> std::io::Result<()> {
    use std::iter;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let src_w: Vec<u16> = src.as_os_str().encode_wide().chain(iter::once(0)).collect();
    let dst_w: Vec<u16> = dst.as_os_str().encode_wide().chain(iter::once(0)).collect();

    let ok = unsafe {
        MoveFileExW(
            src_w.as_ptr(),
            dst_w.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };

    if ok == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupListItem {
    pub id: String,
    pub created_at_utc: String,
    pub path: String,
    pub bytes: i64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct BackupRegistry {
    pub last_auto_backup_at_utc: Option<String>,
    pub backups: Vec<BackupListItem>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifest {
    format_version: i64,
    created_at_utc: String,
    app_version: String,
    profile_id: String,
    #[serde(default)]
    profile_name: Option<String>,
    vault_mode: String,
    files: Vec<BackupManifestFile>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInspectResult {
    pub profile_id: String,
    pub profile_name: String,
    pub created_at_utc: String,
    pub vault_mode: String,
    pub will_overwrite: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifestFile {
    path: String,
    sha256: String,
    bytes: i64,
}

struct BackupSource {
    vault_path: PathBuf,
    attachments_path: PathBuf,
    config_path: Option<PathBuf>,
    settings_path: Option<PathBuf>,
    kdf_salt_path: Option<PathBuf>,
    key_check_path: Option<PathBuf>,
    _temp_dir: Option<tempfile::TempDir>,
}

struct BackupResult {
    id: String,
    created_at_utc: String,
    path: String,
    bytes: i64,
}

fn load_registry(sp: &StoragePaths, profile_id: &str) -> Result<BackupRegistry> {
    let path = backup_registry_path(sp, profile_id)?;
    if !path.exists() {
        return Ok(BackupRegistry::default());
    }
    let content = fs::read_to_string(&path).map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
    serde_json::from_str(&content).map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))
}

fn save_registry(sp: &StoragePaths, profile_id: &str, registry: &BackupRegistry) -> Result<()> {
    let path = backup_registry_path(sp, profile_id)?;
    let serialized = serde_json::to_string_pretty(registry)
        .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
    write_atomic(&path, serialized.as_bytes()).map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))
}

fn update_registry(sp: &StoragePaths, profile_id: &str, update: impl FnOnce(&mut BackupRegistry)) -> Result<()> {
    let mut registry = load_registry(sp, profile_id)?;
    update(&mut registry);
    save_registry(sp, profile_id, &registry)
}

fn now_timestamp() -> String {
    Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string()
}

fn now_utc_string() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn validate_zip_entry_rel_path_windows(rel: &Path) -> bool {
    if rel.is_absolute() {
        return false;
    }

    for component in rel.components() {
        match component {
            Component::Prefix(_) => return false,
            Component::RootDir => return false,
            Component::ParentDir => return false,
            Component::CurDir => {}
            Component::Normal(_) => {}
        }
    }

    true
}

fn validate_profile_id_component(profile_id: &str) -> bool {
    let p = Path::new(profile_id);
    let mut components = p.components();

    matches!((components.next(), components.next()), (Some(Component::Normal(_)), None))
}




#[cfg(unix)]
fn best_effort_fsync_dir(dir: &Path) {
    #[cfg(unix)]
    {
        if let Ok(f) = std::fs::File::open(dir) {
            let _ = f.sync_all();
        }
    }
}

fn best_effort_fsync_rename_dirs(_src: &Path, _dst: &Path) {
    #[cfg(unix)]
    {
        let sp = _src.parent();
        let dp = _dst.parent();
        if let Some(p) = sp {
            best_effort_fsync_dir(p);
        }
        if dp.is_some() && dp != sp {
            best_effort_fsync_dir(dp.unwrap());
        }
    }
}

#[cfg(windows)]
fn rename_platform(src: &Path, dst: &Path) -> std::io::Result<()> {
    use std::iter;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};

    let src_w: Vec<u16> = src.as_os_str().encode_wide().chain(iter::once(0)).collect();
    let dst_w: Vec<u16> = dst.as_os_str().encode_wide().chain(iter::once(0)).collect();
    let ok = unsafe { MoveFileExW(src_w.as_ptr(), dst_w.as_ptr(), MOVEFILE_WRITE_THROUGH) };
    if ok == 0 { Err(std::io::Error::last_os_error()) } else { Ok(()) }
}

#[cfg(not(windows))]
fn rename_platform(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::rename(src, dst)
}

fn rename_with_retry(src: &Path, dst: &Path) -> std::io::Result<()> {
    use std::time::Duration;

    const ATTEMPTS: usize = 60;
    const SLEEP_MS: u64 = 25;

    let mut last_err: Option<std::io::Error> = None;
    for _ in 0..ATTEMPTS {
        match rename_platform(src, dst) {
            Ok(()) => {
                best_effort_fsync_rename_dirs(src, dst);
                return Ok(());
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    last_err = Some(e);
                    std::thread::sleep(Duration::from_millis(SLEEP_MS));
                    continue;
                }
                return Err(e);
            }
        }
    }
    Err(last_err.unwrap_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::Other, "rename failed")
    }))
}

fn ensure_backup_guard(state: &Arc<AppState>) -> Result<std::sync::MutexGuard<'_, ()>> {
    state
        .backup_guard
        .try_lock()
        .map_err(|_| ErrorCodeString::new("BACKUP_ALREADY_RUNNING"))
}

fn add_file_to_zip(
    writer: &mut ZipWriter<fs::File>,
    source_path: &Path,
    archive_path: &str,
    manifest_entries: &mut Vec<BackupManifestFile>,
) -> Result<()> {
    let options = FileOptions::default().compression_method(CompressionMethod::Stored);
    writer
        .start_file(archive_path, options)
        .map_err(|_| ErrorCodeString::new("BACKUP_ZIP_WRITE_FAILED"))?;
    let file = fs::File::open(source_path).map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
    let mut reader = BufReader::new(file);
    let mut buffer = [0u8; 64 * 1024];
    let mut hasher = Sha256::new();
    let mut bytes_written = 0i64;
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
        if read == 0 {
            break;
        }
        writer
            .write_all(&buffer[..read])
            .map_err(|_| ErrorCodeString::new("BACKUP_ZIP_WRITE_FAILED"))?;
        hasher.update(&buffer[..read]);
        bytes_written += read as i64;
    }
    let sha256 = hex::encode(hasher.finalize());
    manifest_entries.push(BackupManifestFile {
        path: archive_path.to_string(),
        sha256,
        bytes: bytes_written,
    });
    Ok(())
}

fn add_optional_file(
    writer: &mut ZipWriter<fs::File>,
    path: Option<PathBuf>,
    archive_path: &str,
    manifest_entries: &mut Vec<BackupManifestFile>,
) -> Result<()> {
    if let Some(path) = path {
        if path.exists() {
            add_file_to_zip(writer, &path, archive_path, manifest_entries)?;
        }
    }
    Ok(())
}

fn build_backup_source(
    state: &Arc<AppState>,
    sp: &StoragePaths,
    profile_id: &str,
) -> Result<(BackupSource, String, String)> {
    let profile = registry::get_profile(sp, profile_id)?
        .ok_or_else(|| ErrorCodeString::new("PROFILE_NOT_FOUND"))?;
    let profile_name = profile.name.clone();
    let vault_mode = if profile.has_password {
        security_service::persist_active_vault(state)?;
        "protected".to_string()
    } else {
        "passwordless".to_string()
    };

    let profile_root = profile_dir(sp, profile_id)?;
    let attachments_path = profile_root.join("attachments");
    let config_path = profile_config_path(sp, profile_id).ok();
    let settings_path = user_settings_path(sp, profile_id).ok();
    let (salt_path, key_check) = if profile.has_password {
        let salt = kdf_salt_path(sp, profile_id)?;
        if !salt.exists() {
            return Err(ErrorCodeString::new("KDF_SALT_MISSING"));
        }
        let key_check = key_check_path(sp, profile_id)?;
        if !key_check.exists() {
            return Err(ErrorCodeString::new("KEY_CHECK_MISSING"));
        }
        (Some(salt), Some(key_check))
    } else {
        (
            kdf_salt_path(sp, profile_id).ok().filter(|path| path.exists()),
            key_check_path(sp, profile_id).ok().filter(|path| path.exists()),
        )
    };

    if !profile.has_password {
        fs::create_dir_all(profile_root.join("tmp"))
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
        let temp_dir = tempfile::Builder::new()
            .prefix("backup_vault_snapshot")
            .tempdir_in(profile_root.join("tmp"))
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
        let vault_path = temp_dir.path().join("vault.db");
        let source_path = vault_db_path(sp, profile_id)?;
        let src_conn = rusqlite::Connection::open(&source_path)
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
        let mut dest_conn = rusqlite::Connection::open(&vault_path)
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
        let backup = rusqlite::backup::Backup::new(&src_conn, &mut dest_conn)
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
        backup
            .run_to_completion(5, std::time::Duration::from_millis(250), None)
            .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;

        Ok((
            BackupSource {
                vault_path,
                attachments_path,
                config_path,
                settings_path,
                kdf_salt_path: salt_path,
                key_check_path: key_check,
                _temp_dir: Some(temp_dir),
            },
            vault_mode,
            profile_name,
        ))
    } else {
        let vault_path = vault_db_path(sp, profile_id)?;
        Ok((
            BackupSource {
                vault_path,
                attachments_path,
                config_path,
                settings_path,
                kdf_salt_path: salt_path,
                key_check_path: key_check,
                _temp_dir: None,
            },
            vault_mode,
            profile_name,
        ))
    }
}

fn create_archive(
    destination: &Path,
    mut source: BackupSource,
    profile_id: &str,
    profile_name: &str,
    vault_mode: &str,
    created_at_utc: &str,
) -> Result<i64> {
    let tmp_dest = PathBuf::from(format!("{}.tmp", destination.display()));
    let file = fs::File::create(&tmp_dest).map_err(|_| ErrorCodeString::new("BACKUP_DESTINATION_UNAVAILABLE"))?;
    let mut writer = ZipWriter::new(file);
    let mut manifest_entries = Vec::new();

    add_file_to_zip(&mut writer, &source.vault_path, "vault.db", &mut manifest_entries)?;

    if source.attachments_path.exists() {
        for entry_res in WalkDir::new(&source.attachments_path).into_iter() {
            let entry = entry_res
                .map_err(|_| ErrorCodeString::new("BACKUP_ATTACHMENTS_ENUM_FAILED"))?;
            if !entry.file_type().is_file() {
                continue;
            }
            let relative = entry
                .path()
                .strip_prefix(&source.attachments_path)
                .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?;
            let relative_str = relative.to_string_lossy().replace('\\', "/");
            let archive_path = format!("attachments/{relative_str}");
            add_file_to_zip(&mut writer, entry.path(), &archive_path, &mut manifest_entries)?;
        }
    }

    add_optional_file(&mut writer, source.config_path, "config.json", &mut manifest_entries)?;
    add_optional_file(
        &mut writer,
        source.settings_path,
        "user_settings.json",
        &mut manifest_entries,
    )?;
    if vault_mode == "protected" {
        let salt_path = source
            .kdf_salt_path
            .as_ref()
            .ok_or_else(|| ErrorCodeString::new("KDF_SALT_MISSING"))?;
        if !salt_path.exists() {
            return Err(ErrorCodeString::new("KDF_SALT_MISSING"));
        }
        add_file_to_zip(&mut writer, salt_path, "kdf_salt.bin", &mut manifest_entries)?;

        let key_check_path = source
            .key_check_path
            .as_ref()
            .ok_or_else(|| ErrorCodeString::new("KEY_CHECK_MISSING"))?;
        if !key_check_path.exists() {
            return Err(ErrorCodeString::new("KEY_CHECK_MISSING"));
        }
        add_file_to_zip(&mut writer, key_check_path, "key_check.bin", &mut manifest_entries)?;
    } else {
        add_optional_file(
            &mut writer,
            source.kdf_salt_path.take(),
            "kdf_salt.bin",
            &mut manifest_entries,
        )?;
        add_optional_file(
            &mut writer,
            source.key_check_path.take(),
            "key_check.bin",
            &mut manifest_entries,
        )?;
    }

    let manifest = BackupManifest {
        format_version: 1,
        created_at_utc: created_at_utc.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        profile_id: profile_id.to_string(),
        profile_name: Some(profile_name.to_string()),
        vault_mode: vault_mode.to_string(),
        files: manifest_entries,
    };
    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|_| ErrorCodeString::new("BACKUP_ZIP_WRITE_FAILED"))?;
    let options = FileOptions::default().compression_method(CompressionMethod::Stored);
    writer
        .start_file("manifest.json", options)
        .map_err(|_| ErrorCodeString::new("BACKUP_ZIP_WRITE_FAILED"))?;
    writer
        .write_all(&manifest_bytes)
        .map_err(|_| ErrorCodeString::new("BACKUP_ZIP_WRITE_FAILED"))?;
    writer
        .finish()
        .map_err(|_| ErrorCodeString::new("BACKUP_ZIP_WRITE_FAILED"))?;

    let replace_result = {
        #[cfg(windows)]
        {
            replace_file_windows(&tmp_dest, destination)
        }
        #[cfg(not(windows))]
        {
            fs::rename(&tmp_dest, destination)
        }
    };

    if replace_result.is_err() {
        if tmp_dest.exists() {
            let _ = fs::remove_file(&tmp_dest);
        }
        return Err(ErrorCodeString::new("BACKUP_CREATE_FAILED"));
    }

    if tmp_dest.exists() {
        let _ = fs::remove_file(&tmp_dest);
    }
    let bytes = fs::metadata(destination)
        .map_err(|_| ErrorCodeString::new("BACKUP_CREATE_FAILED"))?
        .len() as i64;
    Ok(bytes)
}

fn prune_registry(registry: &mut BackupRegistry) {
    registry.backups.retain(|item| PathBuf::from(&item.path).exists());
}

fn apply_max_copies(settings: &UserSettings, managed_root: &Path, registry: &mut BackupRegistry) {
    let mut max_copies = settings.backup_max_copies;
    if max_copies < 1 {
        max_copies = 1;
    }
    let max_copies = max_copies as usize;

    let mut managed: Vec<(usize, chrono::DateTime<Utc>)> = registry
        .backups
        .iter()
        .enumerate()
        .filter_map(|(idx, item)| {
            let path = PathBuf::from(&item.path);
            if !path.starts_with(managed_root) {
                return None;
            }
            let dt = chrono::DateTime::parse_from_rfc3339(&item.created_at_utc)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(Utc::now);
            Some((idx, dt))
        })
        .collect();

    managed.sort_by_key(|(_, dt)| *dt);

    if managed.len() <= max_copies {
        return;
    }

    let to_remove = managed.len() - max_copies;
    let mut remove_indices: Vec<usize> = managed
        .into_iter()
        .take(to_remove)
        .map(|(idx, _)| idx)
        .collect();

    remove_indices.sort_unstable_by(|a, b| b.cmp(a));

    for idx in remove_indices {
        if let Some(entry) = registry.backups.get(idx) {
            let _ = fs::remove_file(&entry.path);
        }
        registry.backups.remove(idx);
    }
}

fn resolve_destination_path(
    sp: &StoragePaths,
    profile_id: &str,
    destination_path: Option<String>,
    use_default_path: bool,
) -> Result<(String, String)> {
    if use_default_path {
        let timestamp = now_timestamp();
        let id = format!("backup_{timestamp}");
        let file_name = format!("backup_{timestamp}_{profile_id}.pmbackup.zip");
        let dest = backups_dir(sp, profile_id)?;
        let path = dest.join(file_name);
        return Ok((id, path.to_string_lossy().to_string()));
    }

    let destination_path = destination_path.ok_or_else(|| ErrorCodeString::new("BACKUP_DESTINATION_REQUIRED"))?;
    let destination = PathBuf::from(destination_path);
    if let Some(parent) = destination.parent() {
        if !parent.exists() {
            return Err(ErrorCodeString::new("BACKUP_DESTINATION_UNAVAILABLE"));
        }
    }

    let timestamp = now_timestamp();
    let id = format!("backup_{timestamp}");
    Ok((id, destination.to_string_lossy().to_string()))
}

fn create_backup_internal(
    state: &Arc<AppState>,
    destination_path: Option<String>,
    use_default_path: bool,
) -> Result<BackupResult> {
    let _guard = ensure_backup_guard(state)?;
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let sp = state.get_storage_paths()?;

    let (backup_id, destination) = resolve_destination_path(&sp, &profile_id, destination_path, use_default_path)?;
    let destination_path = PathBuf::from(&destination);

    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|_| ErrorCodeString::new("BACKUP_DESTINATION_UNAVAILABLE"))?;
    }

    let created_at_utc = now_utc_string();
    let (source, vault_mode, profile_name) = build_backup_source(state, &sp, &profile_id)?;
    let bytes = create_archive(
        &destination_path,
        source,
        &profile_id,
        &profile_name,
        &vault_mode,
        &created_at_utc,
    )?;

    Ok(BackupResult {
        id: backup_id,
        created_at_utc,
        path: destination,
        bytes,
    })
}

pub fn backup_create(
    state: &Arc<AppState>,
    destination_path: Option<String>,
    use_default_path: bool,
) -> Result<String> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let sp = state.get_storage_paths()?;
    let settings = settings_service::get_settings(&sp, &profile_id)?;
    let managed_root = backups_dir(&sp, &profile_id)?;

    let result = create_backup_internal(state, destination_path, use_default_path)?;

    update_registry(&sp, &profile_id, |registry| {
        registry.backups.push(BackupListItem {
            id: result.id.clone(),
            created_at_utc: result.created_at_utc.clone(),
            path: result.path.clone(),
            bytes: result.bytes,
        });
        prune_registry(registry);
        apply_max_copies(&settings, &managed_root, registry);
    })?;

    Ok(result.path)
}

pub fn backup_list(state: &Arc<AppState>) -> Result<Vec<BackupListItem>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let sp = state.get_storage_paths()?;
    let mut registry = load_registry(&sp, &profile_id)?;
    prune_registry(&mut registry);
    save_registry(&sp, &profile_id, &registry)?;
    Ok(registry.backups)
}

fn read_backup_manifest_and_name(backup_path: &Path) -> Result<(BackupManifest, String)> {
    if !backup_path.exists() {
        return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
    }

    let archive_file = fs::File::open(backup_path)
        .map_err(|_| ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|_| ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"))?;

    let mut manifest_contents = String::new();
    {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| ErrorCodeString::new("BACKUP_MANIFEST_MISSING"))?;
        manifest_file
            .read_to_string(&mut manifest_contents)
            .map_err(|_| ErrorCodeString::new("BACKUP_MANIFEST_INVALID"))?;
    }

    let manifest: BackupManifest =
        serde_json::from_str(&manifest_contents).map_err(|_| ErrorCodeString::new("BACKUP_MANIFEST_INVALID"))?;

    if manifest.format_version != 1 {
        return Err(ErrorCodeString::new("BACKUP_UNSUPPORTED_FORMAT"));
    }

    if !validate_profile_id_component(&manifest.profile_id) {
        return Err(ErrorCodeString::new("BACKUP_MANIFEST_INVALID"));
    }

    if let Some(name) = manifest.profile_name.clone() {
        return Ok((manifest, name));
    }

    if let Ok(mut cfg_file) = archive.by_name("config.json") {
        let mut cfg_contents = String::new();
        if cfg_file.read_to_string(&mut cfg_contents).is_ok() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cfg_contents) {
                if let Some(name) = v.get("name").and_then(|n| n.as_str()) {
                    return Ok((manifest, name.to_string()));
                }
            }
        }
    }

    Ok((manifest, "Restored profile".to_string()))
}

pub fn backup_inspect(state: &Arc<AppState>, backup_path: String) -> Result<BackupInspectResult> {
    let sp = state.get_storage_paths()?;
    let backup_path = PathBuf::from(&backup_path);
    let (manifest, profile_name) = read_backup_manifest_and_name(&backup_path)?;
    let will_overwrite = registry::get_profile(&sp, &manifest.profile_id)?.is_some();

    Ok(BackupInspectResult {
        profile_id: manifest.profile_id,
        profile_name,
        created_at_utc: manifest.created_at_utc,
        vault_mode: manifest.vault_mode,
        will_overwrite,
    })
}

fn restore_archive_to_profile(
    _state: &Arc<AppState>,
    sp: &StoragePaths,
    target_profile_id: &str,
    backup_path: &Path,
) -> Result<bool> {
    let backup_path = PathBuf::from(backup_path);
    if !backup_path.exists() {
        return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
    }

    let profile_root = profile_dir(sp, target_profile_id)?;
    fs::create_dir_all(profile_root.join("tmp"))
        .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
    let temp_dir = tempfile::Builder::new()
        .prefix("backup_restore")
        .tempdir_in(profile_root.join("tmp"))
        .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;

    let archive_file = fs::File::open(&backup_path)
        .map_err(|_| ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|_| ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"))?;

    let mut manifest_contents = String::new();
    {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| ErrorCodeString::new("BACKUP_MANIFEST_MISSING"))?;
        manifest_file
            .read_to_string(&mut manifest_contents)
            .map_err(|_| ErrorCodeString::new("BACKUP_MANIFEST_INVALID"))?;
    }

    let manifest: BackupManifest =
        serde_json::from_str(&manifest_contents).map_err(|_| ErrorCodeString::new("BACKUP_MANIFEST_INVALID"))?;

    if manifest.format_version != 1 {
        return Err(ErrorCodeString::new("BACKUP_UNSUPPORTED_FORMAT"));
    }

    if !validate_profile_id_component(&manifest.profile_id) {
        return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
    }

    if manifest.profile_id != target_profile_id {
        return Err(ErrorCodeString::new("BACKUP_PROFILE_MISMATCH"));
    }

    if manifest.files.len() > MAX_RESTORE_FILES {
        return Err(ErrorCodeString::new("BACKUP_ARCHIVE_TOO_MANY_FILES"));
    }

    let mut total_declared: i64 = 0;
    for f in &manifest.files {
        if f.bytes < 0 {
            return Err(ErrorCodeString::new("BACKUP_MANIFEST_INVALID"));
        }
        if f.bytes > MAX_RESTORE_ENTRY_BYTES {
            return Err(ErrorCodeString::new("BACKUP_ARCHIVE_TOO_LARGE"));
        }
        total_declared = total_declared
            .checked_add(f.bytes)
            .ok_or_else(|| ErrorCodeString::new("BACKUP_ARCHIVE_TOO_LARGE"))?;
        if total_declared > MAX_RESTORE_TOTAL_BYTES {
            return Err(ErrorCodeString::new("BACKUP_ARCHIVE_TOO_LARGE"));
        }
    }

    use std::collections::HashSet;
    let mut seen = HashSet::new();
    let mut has_vault = false;
    let mut has_kdf_salt = false;
    let mut has_key_check = false;

    for f in &manifest.files {
        if !seen.insert(&f.path) {
            return Err(ErrorCodeString::new("BACKUP_MANIFEST_INVALID"));
        }
        if f.path == "vault.db" {
            has_vault = true;
        }
        if f.path == "kdf_salt.bin" {
            has_kdf_salt = true;
        }
        if f.path == "key_check.bin" {
            has_key_check = true;
        }
    }

    if !has_vault {
        return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
    }
    if manifest.vault_mode == "protected" {
        if !has_kdf_salt || !has_key_check {
            return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
        }
    } else if manifest.vault_mode != "passwordless" {
        return Err(ErrorCodeString::new("BACKUP_MANIFEST_INVALID"));
    }

    let mut total_written: i64 = 0;
    for entry in &manifest.files {
        let rel_path = Path::new(&entry.path);
        if !validate_zip_entry_rel_path_windows(rel_path) {
            return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
        }
        let mut zipped_file = archive
            .by_name(&entry.path)
            .map_err(|_| ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"))?;
        let target_path = temp_dir.path().join(rel_path);
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        }
        let file = fs::File::create(&target_path)
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        let mut writer = BufWriter::new(file);
        let mut buffer = [0u8; 64 * 1024];
        let mut hasher = Sha256::new();
        let mut bytes_written = 0i64;
        loop {
            let read = zipped_file
                .read(&mut buffer)
                .map_err(|_| ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"))?;
            if read == 0 {
                break;
            }
            writer
                .write_all(&buffer[..read])
                .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
            bytes_written = bytes_written
                .checked_add(read as i64)
                .ok_or_else(|| ErrorCodeString::new("BACKUP_ARCHIVE_TOO_LARGE"))?;
            total_written = total_written
                .checked_add(read as i64)
                .ok_or_else(|| ErrorCodeString::new("BACKUP_ARCHIVE_TOO_LARGE"))?;
            if bytes_written > MAX_RESTORE_ENTRY_BYTES || total_written > MAX_RESTORE_TOTAL_BYTES {
                return Err(ErrorCodeString::new("BACKUP_ARCHIVE_TOO_LARGE"));
            }
            hasher.update(&buffer[..read]);
        }
        writer
            .flush()
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        writer
            .get_ref()
            .sync_all()
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        let sha256 = hex::encode(hasher.finalize());
        if sha256 != entry.sha256 || bytes_written != entry.bytes {
            return Err(ErrorCodeString::new("BACKUP_INTEGRITY_FAILED"));
        }
    }

    let vault_path = vault_db_path(sp, target_profile_id)?;
    let extracted_vault = temp_dir.path().join("vault.db");
    if !extracted_vault.exists() {
        return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
    }

    let attachments_path = profile_root.join("attachments");
    let extracted_attachments = temp_dir.path().join("attachments");
    let attachments_existed_before = attachments_path.exists();

    let vault_backup_path = vault_path.with_extension(format!("old.{}", Uuid::new_v4()));
    let attachments_backup_path = profile_root.join(format!("attachments.old.{}", Uuid::new_v4()));
    let mut moved_vault = false;
    let mut vault_replaced = false;
    let mut vault_tmp_path: Option<PathBuf> = None;
    let mut moved_attachments = false;
    let mut restored_attachments_created = false;
    let restore_result: Result<()> = (|| {
        if vault_path.exists() {
            rename_with_retry(&vault_path, &vault_backup_path)
                .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
            moved_vault = true;
        }

        let tmp = profile_root.join(format!("vault.db.restore.{}", Uuid::new_v4()));
        vault_tmp_path = Some(tmp.clone());
        fs::copy(&extracted_vault, &tmp)
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        // Ensure the copied vault bytes reach disk before we swap it into place.
        fs::File::open(&tmp)
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?
            .sync_all()
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        rename_with_retry(&tmp, &vault_path)
            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
        vault_replaced = true;

        if attachments_path.exists() {
            rename_with_retry(&attachments_path, &attachments_backup_path)
                .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
            moved_attachments = true;
        }

        if extracted_attachments.exists() {
            rename_with_retry(&extracted_attachments, &attachments_path)
                .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
            restored_attachments_created = true;
        } else {
            if !attachments_path.exists() {
                fs::create_dir_all(&attachments_path)
                    .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
                restored_attachments_created = true;
            }
        }

        for file_name in ["config.json", "user_settings.json", "kdf_salt.bin", "key_check.bin"] {
            let extracted_file = temp_dir.path().join(file_name);
            if extracted_file.exists() {
                let target = profile_root.join(file_name);

                // Copy into the profile directory first, so we can swap atomically even if temp_dir
                // lives on a different filesystem/mount.
                let tmp = profile_root.join(format!("{}.restore.{}", file_name, Uuid::new_v4()));
                fs::copy(&extracted_file, &tmp)
                    .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
                fs::File::open(&tmp)
                    .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?
                    .sync_all()
                    .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;

                let replaced = (|| {
                    #[cfg(windows)]
                    {
                        replace_file_windows(&tmp, &target)
                            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
                        best_effort_fsync_rename_dirs(&tmp, &target);
                        return Ok(());
                    }
                    #[cfg(not(windows))]
                    {
                        rename_with_retry(&tmp, &target)
                            .map_err(|_| ErrorCodeString::new("BACKUP_RESTORE_FAILED"))?;
                        return Ok(());
                    }
                })();

                if replaced.is_err() {
                    let _ = fs::remove_file(&tmp);
                    return Err(ErrorCodeString::new("BACKUP_RESTORE_FAILED"));
                }
            }
        }

        Ok(())
    })();

    if restore_result.is_err() {
        if let Some(tmp) = vault_tmp_path.as_ref() {
            if tmp.exists() {
                let _ = fs::remove_file(tmp);
            }
        }
        // Roll back to the pre-restore state as safely as we can.
        // IMPORTANT: never delete the last known-good vault before we have restored it.
        if moved_vault && vault_backup_path.exists() {
            #[cfg(windows)]
            {
                let _ = replace_file_windows(&vault_backup_path, &vault_path);
                best_effort_fsync_rename_dirs(&vault_backup_path, &vault_path);
            }
            #[cfg(not(windows))]
            {
                let _ = fs::rename(&vault_backup_path, &vault_path);
            }
        } else if !moved_vault && vault_replaced && vault_path.exists() {
            // No prior vault existed; remove the partially restored file.
            let _ = fs::remove_file(&vault_path);
        }
        if moved_attachments && attachments_backup_path.exists() {
            if attachments_path.exists() {
                let _ = fs::remove_dir_all(&attachments_path);
            }
            let _ = rename_with_retry(&attachments_backup_path, &attachments_path);
        } else if !attachments_existed_before
            && restored_attachments_created
            && attachments_path.exists()
        {
            let _ = fs::remove_dir_all(&attachments_path);
        }
        return Err(ErrorCodeString::new("BACKUP_RESTORE_FAILED"));
    }

    if vault_backup_path.exists() {
        let _ = fs::remove_file(&vault_backup_path);
    }
    if attachments_backup_path.exists() {
        let _ = fs::remove_dir_all(&attachments_backup_path);
    }

    let wal_path = vault_path.with_extension("db-wal");
    let shm_path = vault_path.with_extension("db-shm");
    let _ = fs::remove_file(&wal_path);
    let _ = fs::remove_file(&shm_path);

    Ok(true)
}

pub fn backup_restore_workflow(state: &Arc<AppState>, backup_path: String) -> Result<bool> {
    let _guard = ensure_backup_guard(state)?;
    // Persist any in-memory changes before restore to avoid data loss on rollback.
    security_service::lock_vault(state)?;
    let sp = state.get_storage_paths()?;

    let backup_path = PathBuf::from(&backup_path);
    let (manifest, profile_name) = read_backup_manifest_and_name(&backup_path)?;

    if manifest.vault_mode == "protected" {
        let mut has_kdf_salt = false;
        let mut has_key_check = false;
        for f in &manifest.files {
            if f.path == "kdf_salt.bin" {
                has_kdf_salt = true;
            }
            if f.path == "key_check.bin" {
                has_key_check = true;
            }
        }
        if !has_kdf_salt || !has_key_check {
            return Err(ErrorCodeString::new("BACKUP_ARCHIVE_INVALID"));
        }
    }

    let exists = registry::get_profile(&sp, &manifest.profile_id)?.is_some();
    if !exists {
        let has_password = manifest.vault_mode == "protected";
        registry::upsert_profile_with_id(&sp, &manifest.profile_id, &profile_name, has_password)?;
    }

    let restored = restore_archive_to_profile(state, &sp, &manifest.profile_id, &backup_path)?;

    // Keep profiles registry in sync with restored state (name + vault mode).
    let has_password = manifest.vault_mode == "protected";
    let _ = registry::upsert_profile_with_id(&sp, &manifest.profile_id, &profile_name, has_password);

    Ok(restored)
}

pub fn backup_create_if_due_auto(state: &Arc<AppState>) -> Result<Option<String>> {
    let profile_id = security_service::require_unlocked_active_profile(state)?.profile_id;
    let sp = state.get_storage_paths()?;
    let settings = settings_service::get_settings(&sp, &profile_id)?;
    if !settings.backups_enabled {
        return Ok(None);
    }
    let managed_root = backups_dir(&sp, &profile_id)?;

    let mut registry = load_registry(&sp, &profile_id)?;
    let last_auto = registry
        .last_auto_backup_at_utc
        .as_ref()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.with_timezone(&Utc));

    let now = Utc::now();
    let interval = chrono::Duration::minutes(settings.auto_backup_interval_minutes);
    if let Some(last) = last_auto {
        if now < last + interval {
            return Ok(None);
        }
    }

    let result = create_backup_internal(state, None, true)?;
    registry.backups.push(BackupListItem {
        id: result.id.clone(),
        created_at_utc: result.created_at_utc.clone(),
        path: result.path.clone(),
        bytes: result.bytes,
    });
    registry.last_auto_backup_at_utc = Some(now_utc_string());
    prune_registry(&mut registry);
    apply_max_copies(&settings, &managed_root, &mut registry);
    save_registry(&sp, &profile_id, &registry)?;

    Ok(Some(result.path))
}
