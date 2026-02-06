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

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let sql = format!("PRAGMA table_info('{table}')");
    let mut stmt = conn.prepare(&sql).map_err(|e| {
        log_sqlite_err(&format!("has_column.prepare table={table} sql={sql}"), &e);
        ErrorCodeString::new("DB_QUERY_FAILED")
    })?;

    let mut rows = stmt.query([]).map_err(|e| {
        log_sqlite_err(&format!("has_column.query table={table} sql={sql}"), &e);
        ErrorCodeString::new("DB_QUERY_FAILED")
    })?;

    while let Some(row) = rows.next().map_err(|e| {
        log_sqlite_err(&format!("has_column.next table={table} sql={sql}"), &e);
        ErrorCodeString::new("DB_QUERY_FAILED")
    })? {
        let name: String = row.get(1).map_err(|e| {
            log_sqlite_err(&format!("has_column.get_name table={table} sql={sql}"), &e);
            ErrorCodeString::new("DB_QUERY_FAILED")
        })?;
        if name == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn is_unique_constraint_error(err: &RusqliteError) -> bool {
    match err {
        RusqliteError::SqliteFailure(info, _) => {
            info.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE
        }
        _ => false,
    }
}

fn ensure_folders_parent_id_schema(conn: &Connection) -> Result<()> {
    // Older workspaces may have been created before folders.parent_id existed.
    // We don't bump user_version in this dev branch; instead, we ensure the column is present.
    if !has_table(conn, "folders")? {
        return Ok(());
    }

    if !has_column(conn, "folders", "parent_id")? {
        log::info!("[DB][migrate] add column folders.parent_id");
        conn.execute_batch("ALTER TABLE folders ADD COLUMN parent_id TEXT NULL;")
            .map_err(|e| {
                log_sqlite_err("ensure_folders_parent_id_schema.alter_table", &e);
                ErrorCodeString::new("DB_MIGRATION_FAILED")
            })?;
    }

    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);")
        .map_err(|e| {
            log_sqlite_err("ensure_folders_parent_id_schema.create_idx_parent", &e);
            ErrorCodeString::new("DB_MIGRATION_FAILED")
        })?;

    // This index enables "folder name unique per parent". For existing DBs that already contain
    // duplicates, creating a UNIQUE index would fail; we log and continue.
    if let Err(e) = conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_name
         ON folders(parent_id, name)
         WHERE deleted_at IS NULL;",
    ) {
        if is_unique_constraint_error(&e) {
            log::warn!(
                "[DB][migrate] cannot create idx_folders_unique_name due to duplicate names; continuing"
            );
        } else {
            log_sqlite_err("ensure_folders_parent_id_schema.create_idx_unique", &e);
            return Err(ErrorCodeString::new("DB_MIGRATION_FAILED"));
        }
    }

    Ok(())
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

    if version == CURRENT_SCHEMA_VERSION {
        log::debug!("[DB][migrate] up_to_date version={version}");
        ensure_folders_parent_id_schema(conn)?;
        return Ok(());
    }

    // Fresh DB: create schema and stamp it with the baseline version.
    if version == 0 {
        log::info!("[DB][migrate] init schema user_version={CURRENT_SCHEMA_VERSION}");
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        ensure_folders_parent_id_schema(conn)?;
        return Ok(());
    }

    log::info!("[DB][migrate] migrate from={version} to={CURRENT_SCHEMA_VERSION}");

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
