#[cfg(target_os = "windows")]
use crate::services::clipboard_service;

#[tauri::command]
pub fn clipboard_clear_all() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        clipboard_service::clear_clipboard_all()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("NOT_SUPPORTED".to_string())
    }
}
