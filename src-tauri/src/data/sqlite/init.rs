use crate::data::profiles::paths::vault_db_path;
use crate::error::{ErrorCodeString, Result};
use rusqlite::Connection;

pub fn init_database(profile_id: &str) -> Result<()> {
    let db_path = vault_db_path(profile_id);
    let conn = Connection::open(db_path).map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;
    let schema = include_str!("schema.sql");
    conn.execute_batch(schema)
        .map_err(|_| ErrorCodeString::new("DB_SCHEMA_APPLY"))?;
    Ok(())
}
