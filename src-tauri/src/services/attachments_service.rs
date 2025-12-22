use std::fs;
use std::path::Path;
use std::sync::Arc;

use base64::engine::general_purpose;
use base64::Engine;
use chrono::Utc;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::data::crypto::cipher;
use crate::data::profiles::paths::{attachment_file_path, attachments_preview_root};
use crate::data::sqlite::repo_impl;
use crate::error::{ErrorCodeString, Result};
use crate::types::{AttachmentMeta, AttachmentPreviewPayload};

const MAX_ATTACHMENT_SIZE_BYTES: u64 = 50 * 1024 * 1024;
const MAX_PREVIEW_BYTES: usize = 8 * 1024 * 1024;

struct ActiveSession {
    state: Arc<AppState>,
    profile_id: String,
    vault_key: Option<[u8; 32]>,
}

fn require_logged_in(app: &AppHandle) -> Result<ActiveSession> {
    let app_state = app.state::<Arc<AppState>>().inner().clone();
    let active_profile = app_state
        .active_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();
    let logged_in_profile = app_state
        .logged_in_profile
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
        .clone();

    match (active_profile, logged_in_profile) {
        (Some(active), Some(logged)) if active == logged => {
            let vault_key = app_state
                .vault_key
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
                .as_ref()
                .map(|k| **k);

            Ok(ActiveSession {
                state: app_state,
                profile_id: active,
                vault_key,
            })
        }
        _ => Err(ErrorCodeString::new("VAULT_LOCKED")),
    }
}

fn read_source_file(path: &Path) -> Result<Vec<u8>> {
    let metadata =
        fs::metadata(path).map_err(|_| ErrorCodeString::new("ATTACHMENT_SOURCE_NOT_FOUND"))?;
    if !metadata.is_file() {
        return Err(ErrorCodeString::new("ATTACHMENT_SOURCE_NOT_FOUND"));
    }
    if metadata.len() > MAX_ATTACHMENT_SIZE_BYTES {
        return Err(ErrorCodeString::new("ATTACHMENT_TOO_LARGE"));
    }

    fs::read(path).map_err(|_| ErrorCodeString::new("ATTACHMENT_READ_FAILED"))
}

fn ensure_target_dir(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"))?;
    }
    Ok(())
}

pub fn add_attachment_from_path(
    app: &AppHandle,
    datacard_id: String,
    source_path: String,
) -> Result<AttachmentMeta> {
    let session = require_logged_in(app)?;
    let source = Path::new(&source_path);
    if source.file_name().is_none() {
        return Err(ErrorCodeString::new("ATTACHMENT_SOURCE_NOT_FOUND"));
    }

    // Validate datacard exists for this profile
    let _ = repo_impl::get_datacard(&session.state, &session.profile_id, &datacard_id)?;

    let bytes = read_source_file(source)?;
    let attachment_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_string();

    let meta = AttachmentMeta {
        id: attachment_id.clone(),
        datacard_id,
        file_name,
        mime_type: None,
        byte_size: bytes.len() as i64,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    };

    let file_path =
        attachment_file_path(&session.state.storage_paths, &session.profile_id, &meta.id);
    ensure_target_dir(&file_path)?;

    if let Some(key) = session.vault_key {
        let encrypted =
            cipher::encrypt_attachment_blob(&session.profile_id, &meta.id, &key, &bytes)?;
        fs::write(&file_path, &encrypted)
            .map_err(|_| ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"))?;
    } else {
        fs::write(&file_path, &bytes)
            .map_err(|_| ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"))?;
    }

    repo_impl::insert_attachment(&session.state, &session.profile_id, &meta)?;

    Ok(meta)
}

pub fn list_attachments(app: &AppHandle, datacard_id: String) -> Result<Vec<AttachmentMeta>> {
    let session = require_logged_in(app)?;
    repo_impl::list_attachments_by_datacard(&session.state, &session.profile_id, &datacard_id)
}

pub fn remove_attachment(app: &AppHandle, attachment_id: String) -> Result<()> {
    let session = require_logged_in(app)?;
    let now = Utc::now().to_rfc3339();
    repo_impl::soft_delete_attachment(&session.state, &session.profile_id, &attachment_id, &now)
}

pub fn purge_attachment(app: &AppHandle, attachment_id: String) -> Result<()> {
    let session = require_logged_in(app)?;
    let meta = repo_impl::get_attachment(&session.state, &session.profile_id, &attachment_id)?
        .ok_or_else(|| ErrorCodeString::new("ATTACHMENT_NOT_FOUND"))?;

    let file_path =
        attachment_file_path(&session.state.storage_paths, &session.profile_id, &meta.id);
    let _ = fs::remove_file(file_path);
    repo_impl::purge_attachment(&session.state, &session.profile_id, &attachment_id)
}

pub fn save_attachment_to_path(
    app: &AppHandle,
    attachment_id: String,
    target_path: String,
) -> Result<()> {
    let session = require_logged_in(app)?;
    let meta = repo_impl::get_attachment(&session.state, &session.profile_id, &attachment_id)?
        .ok_or_else(|| ErrorCodeString::new("ATTACHMENT_NOT_FOUND"))?;
    if meta.deleted_at.is_some() {
        return Err(ErrorCodeString::new("ATTACHMENT_NOT_FOUND"));
    }

    let stored_path =
        attachment_file_path(&session.state.storage_paths, &session.profile_id, &meta.id);
    let bytes =
        fs::read(&stored_path).map_err(|_| ErrorCodeString::new("ATTACHMENT_READ_FAILED"))?;
    let output_bytes = if let Some(key) = session.vault_key {
        cipher::decrypt_attachment_blob(&session.profile_id, &meta.id, &key, &bytes)?
    } else {
        bytes
    };

    let target = Path::new(&target_path);
    ensure_target_dir(target)?;
    fs::write(target, &output_bytes).map_err(|_| ErrorCodeString::new("ATTACHMENT_WRITE_FAILED"))
}

pub fn get_attachment_preview(
    app: &AppHandle,
    attachment_id: String,
) -> Result<AttachmentPreviewPayload> {
    let session = require_logged_in(app)?;
    let meta = repo_impl::get_attachment(&session.state, &session.profile_id, &attachment_id)?
        .ok_or_else(|| ErrorCodeString::new("ATTACHMENT_NOT_FOUND"))?;
    if meta.deleted_at.is_some() {
        return Err(ErrorCodeString::new("ATTACHMENT_NOT_FOUND"));
    }

    if meta.byte_size as usize > MAX_PREVIEW_BYTES {
        return Err(ErrorCodeString::new("ATTACHMENT_TOO_LARGE_FOR_PREVIEW"));
    }

    let stored_path =
        attachment_file_path(&session.state.storage_paths, &session.profile_id, &meta.id);
    let bytes =
        fs::read(&stored_path).map_err(|_| ErrorCodeString::new("ATTACHMENT_READ_FAILED"))?;

    let output_bytes = if let Some(key) = session.vault_key {
        cipher::decrypt_attachment_blob(&session.profile_id, &meta.id, &key, &bytes)?
    } else {
        bytes
    };

    if output_bytes.len() > MAX_PREVIEW_BYTES {
        return Err(ErrorCodeString::new("ATTACHMENT_TOO_LARGE_FOR_PREVIEW"));
    }

    let mime = meta
        .mime_type
        .clone()
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let base64_data = general_purpose::STANDARD.encode(output_bytes);

    Ok(AttachmentPreviewPayload {
        attachment_id: meta.id,
        file_name: meta.file_name,
        mime_type: mime,
        byte_size: meta.byte_size,
        base64_data,
    })
}

pub fn get_attachment_bytes_base64(
    app: &AppHandle,
    attachment_id: String,
) -> Result<AttachmentPreviewPayload> {
    get_attachment_preview(app, attachment_id)
}

pub fn clear_previews_for_profile(state: &Arc<AppState>, profile_id: &str) -> Result<()> {
    let preview_root = attachments_preview_root(&state.storage_paths, profile_id);
    if preview_root.exists() {
        let _ = fs::remove_dir_all(&preview_root);
    }
    Ok(())
}
