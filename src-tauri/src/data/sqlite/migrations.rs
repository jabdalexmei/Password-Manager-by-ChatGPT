use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 1;

fn ensure_ui_preferences_table(conn: &Connection) -> Result<()> {
    // Dev-mode friendly: create idempotently so existing schema=1 DBs also get it.
    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS ui_preferences (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
"#,
    )
    .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    Ok(())
}

pub fn migrate_to_latest(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    log::info!(
        "[DB][migrate] user_version={version}, current={CURRENT_SCHEMA_VERSION}"
    );

    // Fresh DB: create schema and stamp it with the current version.
    if version == 0 {
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        ensure_ui_preferences_table(conn)?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        return Ok(());
    }

    match version {
        CURRENT_SCHEMA_VERSION => {
            ensure_ui_preferences_table(conn)?;
            Ok(())
        }
        _ => {
            // Development-mode behavior: we do not support upgrading legacy schemas yet.
            // Refuse instead of attempting destructive rebuild.
            log::warn!("[DB][migrate] unsupported schema version: {version}");
            Err(ErrorCodeString::new("DB_MIGRATION_FAILED"))
        }
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
