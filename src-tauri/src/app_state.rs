use std::sync::{Arc, Mutex};

use zeroize::Zeroizing;

use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

pub struct AppState {
    pub active_profile: Mutex<Option<String>>,
    pub logged_in_profile: Mutex<Option<String>>,
    pub storage_paths: Mutex<StoragePaths>,

    pub vault_keeper_conn: Mutex<Option<rusqlite::Connection>>,
    pub vault_db_uri: Mutex<Option<String>>,
    pub vault_key: Mutex<Option<Zeroizing<[u8; 32]>>>,
    pub vault_persist_guard: Mutex<()>,
    pub backup_guard: Mutex<()>,
}

impl AppState {
    pub fn new(storage_paths: StoragePaths) -> Self {
        Self {
            active_profile: Mutex::new(None),
            logged_in_profile: Mutex::new(None),
            storage_paths: Mutex::new(storage_paths),

            vault_keeper_conn: Mutex::new(None),
            vault_db_uri: Mutex::new(None),
            vault_key: Mutex::new(None),
            vault_persist_guard: Mutex::new(()),
            backup_guard: Mutex::new(()),
        }
    }

    pub fn set_workspace_root(&self, workspace_root: std::path::PathBuf) -> Result<()> {
        {
            let mut storage_paths = self
                .storage_paths
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            storage_paths.configure_workspace(workspace_root)?;
        }
        self.clear_security_state()?;
        Ok(())
    }

    pub fn clear_workspace_root(&self) -> Result<()> {
        {
            let mut storage_paths = self
                .storage_paths
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            storage_paths.clear_workspace();
        }
        self.clear_security_state()?;
        Ok(())
    }

    pub fn get_storage_paths(&self) -> Result<StoragePaths> {
        let storage_paths = self
            .storage_paths
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        if storage_paths.workspace_root().is_err() {
            return Err(ErrorCodeString::new("WORKSPACE_NOT_SELECTED"));
        }
        Ok(storage_paths.clone())
    }

    pub fn logout_and_cleanup(self: &Arc<Self>) -> Result<()> {
        let is_logged_in = self
            .logged_in_profile
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .is_some();

        if is_logged_in {
            crate::services::security_service::lock_vault(self)?;
        }

        crate::data::sqlite::pool::clear_all_pools();

        self.clear_security_state()?;

        Ok(())
    }

    fn clear_security_state(&self) -> Result<()> {
        {
            let mut active = self
                .active_profile
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            *active = None;
        }
        {
            let mut logged_in = self
                .logged_in_profile
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            *logged_in = None;
        }
        {
            let mut keeper = self
                .vault_keeper_conn
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            *keeper = None;
        }
        {
            let mut uri = self
                .vault_db_uri
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            *uri = None;
        }
        {
            let mut key = self
                .vault_key
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            *key = None;
        }
        Ok(())
    }
}
