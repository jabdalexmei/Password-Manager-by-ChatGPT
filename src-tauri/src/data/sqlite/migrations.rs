use rusqlite::Connection;
use rusqlite::Error as RusqliteError;
use rusqlite::OptionalExtension;

use crate::error::{ErrorCodeString, Result};

// Dev baseline: single schema version.
// We intentionally do NOT support in-place upgrades/downgrades. If you somehow have a DB with a
// different user_version, delete the profile/workspace and create a fresh one.
const CURRENT_SCHEMA_VERSION: i32 = 1;

fn log_sqlite_err(ctx: &str, err: &RusqliteError) {
    match err {
        RusqliteError::SqliteFailure(e, msg) => {
            log::error!(
                "[DB][sqlite_error] ctx={} code={:?} extended_code={} msg={}",
                ctx,
                e.code,
                e.extended_code,
                msg.as_deref().unwrap_or("")
            );
        }
        other => {
            log::error!("[DB][sqlite_error] ctx={} err={other:?}", ctx);
        }
    }
}

fn has_table(conn: &Connection, name: &str) -> Result<bool> {
    let sql = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1 LIMIT 1";
    let exists: Option<i32> = conn
        .query_row(sql, [name], |row| row.get(0))
        .optional()
        .map_err(|e| {
            log_sqlite_err(&format!("has_table.query_row name={name} sql={sql}"), &e);
            ErrorCodeString::new("DB_QUERY_FAILED")
        })?;
    Ok(exists.is_some())
}

pub fn migrate_to_latest(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| {
            log_sqlite_err("migrate_to_latest.execute_batch PRAGMA foreign_keys=ON", &e);
            ErrorCodeString::new("DB_QUERY_FAILED")
        })?;

    let version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .map_err(|e| {
            log_sqlite_err("migrate_to_latest.query_row PRAGMA user_version", &e);
            ErrorCodeString::new("DB_QUERY_FAILED")
        })?;

    // Fresh DB: create schema and stamp it with the baseline version.
    if version == 0 {
        log::info!("[DB][migrate] init schema user_version={CURRENT_SCHEMA_VERSION}");
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        return Ok(());
    }

    // Current baseline.
    if version == CURRENT_SCHEMA_VERSION {
        return Ok(());
    }

    // Any other version is unsupported in this dev branch.
    log::warn!(
        "[DB][migrate] unsupported schema version: {version} (expected {CURRENT_SCHEMA_VERSION})"
    );
    Err(ErrorCodeString::new("DB_MIGRATION_FAILED"))
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
