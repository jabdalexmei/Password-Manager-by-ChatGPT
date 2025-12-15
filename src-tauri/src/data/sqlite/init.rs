use rusqlite::Connection;

use crate::data::profiles::paths::{ensure_profile_dirs, vault_db_path};
use crate::error::{ErrorCodeString, Result};

use super::migrations;

pub fn init_database(profile_id: &str) -> Result<()> {
    ensure_profile_dirs(profile_id).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let conn = Connection::open(vault_db_path(profile_id))
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;

    migrations::migrate_to_latest(&conn)
}
