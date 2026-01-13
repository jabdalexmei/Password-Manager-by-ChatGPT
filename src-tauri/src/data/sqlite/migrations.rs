use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 3;

fn ensure_ui_preferences_table(conn: &Connection) -> Result<()> {
    // Dev-mode friendly: create idempotently so existing schema DBs also get it.
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

fn has_table(conn: &Connection, name: &str) -> Result<bool> {
    let sql = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1 LIMIT 1";
    let exists: Option<i32> = conn
        .query_row(sql, [name], |row| row.get(0))
        .optional()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    Ok(exists.is_some())
}

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let sql = format!("PRAGMA table_info({table});");
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let mut rows = stmt
        .query([])
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    while let Some(row) = rows
        .next()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
    {
        let name: String = row.get(1).map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn migrate_1_to_2(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Add per-datacard preview fields storage.
    if has_table(conn, "datacards")? && !has_column(conn, "datacards", "preview_fields_json")? {
        conn.execute_batch(
            r#"
ALTER TABLE datacards
ADD COLUMN preview_fields_json TEXT NOT NULL DEFAULT '[]';
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 2;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    Ok(())
}

fn migrate_2_to_3(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Add recovery email field to datacards.
    if has_table(conn, "datacards")? && !has_column(conn, "datacards", "recovery_email")? {
        conn.execute_batch(
            r#"
ALTER TABLE datacards
ADD COLUMN recovery_email TEXT NULL;
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 3;")
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
        1 => {
            migrate_1_to_2(conn)?;
            migrate_2_to_3(conn)
        }
        2 => migrate_2_to_3(conn),
        CURRENT_SCHEMA_VERSION => {
            ensure_ui_preferences_table(conn)?;
            Ok(())
        }
        _ => {
            log::warn!("[DB][migrate] unsupported schema version: {version}");
            Err(ErrorCodeString::new("DB_MIGRATION_FAILED"))
        }
    }
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
