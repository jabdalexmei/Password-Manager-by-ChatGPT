use serde::{Deserialize, Serialize};

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
