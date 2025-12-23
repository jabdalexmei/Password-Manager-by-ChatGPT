use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileMeta {
    pub id: String,
    pub name: String,
    pub has_password: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentMeta {
    pub id: String,
    pub datacard_id: String,
    pub file_name: String,
    pub mime_type: Option<String>,
    pub byte_size: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentPreviewPayload {
    pub attachment_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_size: i64,
    pub base64_data: String,
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
    pub is_system: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BankCard {
    pub holder: String,
    pub number: String,
    pub expiry_mm_yy: String,
    pub cvc: String,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum CustomFieldType {
    Text,
    Secret,
    Url,
    Number,
    Date,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomField {
    pub key: String,
    pub value: String,
    #[serde(rename = "type")]
    pub field_type: CustomFieldType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataCard {
    pub id: String,
    pub folder_id: Option<String>,

    pub title: String,
    pub url: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub mobile_phone: Option<String>,
    pub note: Option<String>,
    pub is_favorite: bool,
    pub tags: Vec<String>,

    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,

    pub password: Option<String>,
    pub bank_card: Option<BankCard>,
    pub custom_fields: Vec<CustomField>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PasswordHistoryRow {
    pub id: String,
    pub datacard_id: String,
    pub password_value: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataCardSummary {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub url: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub is_favorite: bool,
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
    pub url: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub mobile_phone: Option<String>,
    pub note: Option<String>,
    pub tags: Vec<String>,
    pub password: Option<String>,
    pub bank_card: Option<BankCard>,
    pub custom_fields: Vec<CustomField>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateDataCardInput {
    pub id: String,
    pub title: String,
    pub url: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub mobile_phone: Option<String>,
    pub note: Option<String>,
    pub tags: Vec<String>,
    pub password: Option<String>,
    pub bank_card: Option<BankCard>,
    pub custom_fields: Vec<CustomField>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MoveDataCardInput {
    pub id: String,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SetDataCardFavoriteInput {
    pub id: String,
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSettings {
    pub auto_hide_secret_timeout_seconds: i64,
    pub auto_lock_enabled: bool,
    pub auto_lock_timeout: i64,
    pub reveal_requires_confirmation: bool,

    pub clipboard_clear_timeout_seconds: i64,

    pub soft_delete_enabled: bool,
    pub trash_retention_days: i64,

    pub backups_enabled: bool,
    pub backup_frequency: String,
    pub backup_retention_days: i64,

    pub default_export_dir: Option<String>,
    pub last_export_dir: Option<String>,

    pub default_sort_field: String,
    pub default_sort_direction: String,

    pub mask_password_by_default: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            auto_hide_secret_timeout_seconds: 15,
            auto_lock_enabled: true,
            auto_lock_timeout: 300,
            reveal_requires_confirmation: false,
            clipboard_clear_timeout_seconds: 30,
            soft_delete_enabled: true,
            trash_retention_days: 30,
            backups_enabled: false,
            backup_frequency: "weekly".to_string(),
            backup_retention_days: 30,
            default_export_dir: None,
            last_export_dir: None,
            default_sort_field: "updated_at".to_string(),
            default_sort_direction: "DESC".to_string(),
            mask_password_by_default: true,
        }
    }
}
