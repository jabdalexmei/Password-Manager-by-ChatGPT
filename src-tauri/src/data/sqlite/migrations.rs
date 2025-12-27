use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 6;

pub fn migrate_to_latest(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    log::info!(
        "[DB][migrate] user_version={version}, current={CURRENT_SCHEMA_VERSION}"
    );

    if version < CURRENT_SCHEMA_VERSION {
        conn.execute_batch(
            "PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS datacard_password_history;
DROP TABLE IF EXISTS password_history;
DROP TABLE IF EXISTS datacards;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS bank_cards;",
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        return Ok(());
    }

    match version {
        CURRENT_SCHEMA_VERSION => Ok(()),
        _ => Err(ErrorCodeString::new("DB_MIGRATION_FAILED")),
    }
}

fn has_table(conn: &Connection, name: &str) -> Result<bool> {
    let sql = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1 LIMIT 1";
    let exists: Option<i32> = conn
        .query_row(sql, [name], |row| row.get(0))
        .optional()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    Ok(exists.is_some())
}

pub fn validate_core_schema(conn: &Connection) -> Result<()> {
    let required = ["folders", "datacards", "bank_cards"];
    for table in required {
        if !has_table(conn, table)? {
            return Err(ErrorCodeString::new("DB_SCHEMA_MISSING"));
        }
    }
    Ok(())
}
