use tauri::AppHandle;

use crate::error::{ErrorCodeString, Result};
use crate::services::attachments_service;
use crate::types::AttachmentMeta;

#[tauri::command]
pub async fn list_attachments(app: AppHandle, datacard_id: String) -> Result<Vec<AttachmentMeta>> {
    tauri::async_runtime::spawn_blocking(move || {
        attachments_service::list_attachments(&app, datacard_id)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn add_attachment_from_path(
    app: AppHandle,
    datacard_id: String,
    source_path: String,
) -> Result<AttachmentMeta> {
    tauri::async_runtime::spawn_blocking(move || {
        attachments_service::add_attachment_from_path(&app, datacard_id, source_path)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn remove_attachment(app: AppHandle, attachment_id: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        attachments_service::remove_attachment(&app, attachment_id)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn purge_attachment(app: AppHandle, attachment_id: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        attachments_service::purge_attachment(&app, attachment_id)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}

#[tauri::command]
pub async fn save_attachment_to_path(
    app: AppHandle,
    attachment_id: String,
    target_path: String,
) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        attachments_service::save_attachment_to_path(&app, attachment_id, target_path)
    })
    .await
    .map_err(|_| ErrorCodeString::new("TASK_JOIN_FAILED"))?
}
