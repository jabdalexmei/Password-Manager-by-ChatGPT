use rusqlite::Connection;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 1;

pub fn migrate_to_latest(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    match version {
        0 => {
            conn.execute_batch(include_str!("schema.sql"))
                .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
            conn.execute_batch("PRAGMA user_version = 1;")
                .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
            Ok(())
        }
        CURRENT_SCHEMA_VERSION => Ok(()),
        _ => Err(ErrorCodeString::new("DB_MIGRATION_FAILED")),
    }
}
