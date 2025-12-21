use rusqlite::Connection;

use crate::data::profiles::paths::{ensure_profile_dirs, vault_db_path};
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

use super::migrations;

pub fn init_database(sp: &StoragePaths, profile_id: &str) -> Result<()> {
    ensure_profile_dirs(sp, profile_id).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let conn = Connection::open(vault_db_path(sp, profile_id))
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;

    migrations::migrate_to_latest(&conn)
}
