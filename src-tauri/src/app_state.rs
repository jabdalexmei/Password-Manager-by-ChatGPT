use std::sync::Mutex;

use crate::data::storage_paths::StoragePaths;

pub struct AppState {
    pub active_profile: Mutex<Option<String>>,
    pub logged_in_profile: Mutex<Option<String>>,
    pub storage_paths: StoragePaths,
}

impl AppState {
    pub fn new(storage_paths: StoragePaths) -> Self {
        Self {
            active_profile: Mutex::new(None),
            logged_in_profile: Mutex::new(None),
            storage_paths,
        }
    }
}
