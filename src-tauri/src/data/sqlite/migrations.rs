use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 9;

pub fn migrate_to_latest(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    log::info!(
        "[DB][migrate] user_version={version}, current={CURRENT_SCHEMA_VERSION}"
    );

    // Fresh DB (or reset state): create full schema at latest version.
    if version == 0 {
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        return Ok(());
    }

    // Legacy versions: easiest/safest is rebuild (you said old data is not important).
    if version < 6 {
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

    // v8 -> v9: add folder_id to bank_cards (idempotent).
    if version == 8 {
        if !has_column(conn, "bank_cards", "folder_id")? {
            conn.execute_batch("ALTER TABLE bank_cards ADD COLUMN folder_id TEXT NULL;")
                .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }
        // Index is safe to (re)create.
        conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_bank_cards_folder ON bank_cards (folder_id);")
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        return Ok(());
    }

    // v6 -> v8: add seed phrase columns (idempotent).
    if version == 6 {
        if !has_column(conn, "datacards", "seed_phrase_value")? {
            conn.execute_batch("ALTER TABLE datacards ADD COLUMN seed_phrase_value TEXT NULL;")
                .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }
        if !has_column(conn, "datacards", "seed_phrase_word_count")? {
            conn.execute_batch(
                "ALTER TABLE datacards ADD COLUMN seed_phrase_word_count INTEGER NULL;",
            )
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }

        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        return Ok(());
    }

    // v7 -> v8: rename seed phrase word count column.
    if version == 7 {
        if !has_column(conn, "datacards", "seed_phrase_word_count")? {
            conn.execute_batch(
                "ALTER TABLE datacards ADD COLUMN seed_phrase_word_count INTEGER NULL;",
            )
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }
        if has_column(conn, "datacards", "seed_phrase_words")? {
            conn.execute_batch(
                "UPDATE datacards SET seed_phrase_word_count = seed_phrase_words WHERE seed_phrase_word_count IS NULL;",
            )
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        }

        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION};"))
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

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let sql = "SELECT 1 FROM pragma_table_info(?1) WHERE name = ?2 LIMIT 1";
    let exists: Option<i32> = conn
        .query_row(sql, [table, column], |row| row.get(0))
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
