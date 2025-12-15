use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileMeta {
    pub id: String,
    pub name: String,
    pub has_password: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProfilesList {
    pub profiles: Vec<ProfileMeta>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataCard {
    pub id: String,
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub folder_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateFolderInput {
    pub name: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameFolderInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MoveFolderInput {
    pub id: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateDataCardInput {
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateDataCardInput {
    pub id: String,
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MoveDataCardInput {
    pub id: String,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSettings {
    pub auto_hide_secret_timeout_seconds: u32,
    pub clipboard_clear_timeout_seconds: u32,
    pub auto_lock_timeout: u32,
    pub trash_retention_days: u32,
    pub backup_retention_days: u32,
    pub backup_frequency: String,
    pub default_sort_field: String,
    pub default_sort_direction: String,
    pub soft_delete_enabled: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            auto_hide_secret_timeout_seconds: 30,
            clipboard_clear_timeout_seconds: 30,
            auto_lock_timeout: 300,
            trash_retention_days: 30,
            backup_retention_days: 30,
            backup_frequency: "weekly".to_string(),
            default_sort_field: "created_at".to_string(),
            default_sort_direction: "DESC".to_string(),
            soft_delete_enabled: true,
        }
    }
}
