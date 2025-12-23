use std::sync::Mutex;

use zeroize::Zeroizing;

use crate::data::storage_paths::StoragePaths;

pub struct AppState {
    pub active_profile: Mutex<Option<String>>,
    pub logged_in_profile: Mutex<Option<String>>,
    pub storage_paths: StoragePaths,

    pub vault_keeper_conn: Mutex<Option<rusqlite::Connection>>,
    pub vault_db_uri: Mutex<Option<String>>,
    pub vault_key: Mutex<Option<Zeroizing<[u8; 32]>>>,
}

impl AppState {
    pub fn new(storage_paths: StoragePaths) -> Self {
        Self {
            active_profile: Mutex::new(None),
            logged_in_profile: Mutex::new(None),
            storage_paths,

            vault_keeper_conn: Mutex::new(None),
            vault_db_uri: Mutex::new(None),
            vault_key: Mutex::new(None),
        }
    }
}
