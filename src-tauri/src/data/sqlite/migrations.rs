use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 8;

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

fn migrate_3_to_4(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Add per-datacard archived timestamp (soft-archive).
    if has_table(conn, "datacards")? && !has_column(conn, "datacards", "archived_at")? {
        conn.execute_batch(
            r#"
ALTER TABLE datacards
ADD COLUMN archived_at TEXT NULL;
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        // Best-effort migration from legacy tag-based archive (if it ever existed).
        // We intentionally keep tags_json unchanged; UI will rely on archived_at going forward.
        conn.execute_batch(
            r#"
UPDATE datacards
SET archived_at = COALESCE(archived_at, updated_at)
WHERE archived_at IS NULL
  AND tags_json LIKE '%"archived"%';
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 4;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    Ok(())
}

fn migrate_6_to_7(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Add per-bankcard preview fields storage.
    if has_table(conn, "bank_cards")? && !has_column(conn, "bank_cards", "preview_fields_json")? {
        conn.execute_batch(
            r#"
ALTER TABLE bank_cards
ADD COLUMN preview_fields_json TEXT NOT NULL DEFAULT '{}';
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 7;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    Ok(())
}

fn migrate_7_to_8(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Older vaults might have bank_cards without some of the newer optional columns.
    // Ensure they exist so summary queries remain compatible.
    if has_table(conn, "bank_cards")? {
        if !has_column(conn, "bank_cards", "note")? {
            conn.execute_batch(
                r#"
ALTER TABLE bank_cards
ADD COLUMN note TEXT NULL;
"#,
            )
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }

        if !has_column(conn, "bank_cards", "preview_fields_json")? {
            conn.execute_batch(
                r#"
ALTER TABLE bank_cards
ADD COLUMN preview_fields_json TEXT NOT NULL DEFAULT '{}';
"#,
            )
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }
    }

        // Some legacy vaults may have NULLs in newly-added columns (SQLite keeps NULL for preexisting rows in some cases).
        // Normalize to safe JSON defaults to avoid runtime deserialization failures.
        conn.execute_batch(
            r#"
UPDATE bank_cards SET tags_json = '[]' WHERE tags_json IS NULL OR tags_json = '';
UPDATE bank_cards SET preview_fields_json = '{}' WHERE preview_fields_json IS NULL OR preview_fields_json = '';
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    conn.execute_batch("PRAGMA user_version = 8;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    Ok(())
}

fn migrate_4_to_5(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Add per-bank-card archived timestamp (soft-archive).
    if has_table(conn, "bank_cards")? && !has_column(conn, "bank_cards", "archived_at")? {
        conn.execute_batch(
            r#"
ALTER TABLE bank_cards
ADD COLUMN archived_at TEXT NULL;
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        conn.execute_batch(
            r#"
CREATE INDEX IF NOT EXISTS idx_bank_cards_archived_at ON bank_cards (archived_at);
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        // Best-effort: if legacy tag-based archive exists, carry it over.
        conn.execute_batch(
            r#"
UPDATE bank_cards
SET archived_at = COALESCE(archived_at, updated_at)
WHERE archived_at IS NULL
  AND tags_json LIKE '%"archived"%';
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 5;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    Ok(())
}

fn migrate_5_to_6(conn: &Connection) -> Result<()> {
    ensure_ui_preferences_table(conn)?;

    // Add bank name field to bank_cards.
    if has_table(conn, "bank_cards")? && !has_column(conn, "bank_cards", "bank_name")? {
        conn.execute_batch(
            r#"
ALTER TABLE bank_cards
ADD COLUMN bank_name TEXT NULL;
"#,
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 6;")
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
            migrate_2_to_3(conn)?;
            migrate_3_to_4(conn)?;
            migrate_4_to_5(conn)?;
            migrate_5_to_6(conn)?;
            migrate_6_to_7(conn)?;
            migrate_7_to_8(conn)
        }
        2 => {
            migrate_2_to_3(conn)?;
            migrate_3_to_4(conn)?;
            migrate_4_to_5(conn)?;
            migrate_5_to_6(conn)?;
            migrate_6_to_7(conn)?;
            migrate_7_to_8(conn)
        }
        3 => {
            migrate_3_to_4(conn)?;
            migrate_4_to_5(conn)?;
            migrate_5_to_6(conn)?;
            migrate_6_to_7(conn)?;
            migrate_7_to_8(conn)
        }
        4 => {
            migrate_4_to_5(conn)?;
            migrate_5_to_6(conn)?;
            migrate_6_to_7(conn)?;
            migrate_7_to_8(conn)
        }
        5 => {
            migrate_5_to_6(conn)?;
            migrate_6_to_7(conn)?;
            migrate_7_to_8(conn)
        }
        6 => {
            migrate_6_to_7(conn)?;
            migrate_7_to_8(conn)
        }
        7 => migrate_7_to_8(conn),
        CURRENT_SCHEMA_VERSION => migrate_7_to_8(conn),
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
