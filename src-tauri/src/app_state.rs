use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

use zeroize::Zeroizing;

pub struct VaultSession {
    pub profile_id: String,
    pub conn: rusqlite::Connection,
    pub key: Zeroizing<[u8; 32]>,
}

pub struct AppState {
    pub active_profile: Mutex<Option<String>>,
    pub storage_paths: Mutex<StoragePaths>,

    pub vault_session: Mutex<Option<VaultSession>>,
    pub vault_persist_guard: Mutex<()>,
    pub vault_persist_requested: AtomicBool,
    pub vault_persist_in_flight: AtomicBool,
    pub backup_guard: Mutex<()>,
}

impl AppState {
    pub fn new(storage_paths: StoragePaths) -> Self {
        Self {
            active_profile: Mutex::new(None),
            storage_paths: Mutex::new(storage_paths),

            vault_session: Mutex::new(None),
            vault_persist_guard: Mutex::new(()),
            vault_persist_requested: AtomicBool::new(false),
            vault_persist_in_flight: AtomicBool::new(false),
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
        crate::services::security_service::lock_vault(self)?;

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
            let mut session = self
                .vault_session
                .lock()
                .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
            *session = None;
        }
        Ok(())
    }
}
