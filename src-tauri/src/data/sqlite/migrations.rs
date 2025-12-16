use rusqlite::Connection;
use serde_json::Value;

use crate::error::{ErrorCodeString, Result};

const CURRENT_SCHEMA_VERSION: i32 = 2;

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
            conn.execute_batch("PRAGMA user_version = 2;")
                .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
            Ok(())
        }
        1 => migrate_from_v1_to_v2(conn),
        CURRENT_SCHEMA_VERSION => Ok(()),
        _ => Err(ErrorCodeString::new("DB_MIGRATION_FAILED")),
    }
}

fn migrate_from_v1_to_v2(conn: &Connection) -> Result<()> {
    conn.execute(
        "ALTER TABLE datacards ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;",
        [],
    )
    .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    let mut stmt = conn
        .prepare("SELECT id, tags_json FROM datacards;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let tags_json: String = row.get(1)?;
            Ok((id, tags_json))
        })
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    for row in rows {
        let (id, tags_json) = row.map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        let parsed: Value = serde_json::from_str(&tags_json)
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
        let mut tags: Vec<String> = serde_json::from_value(parsed)
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        let mut is_favorite = false;
        tags.retain(|tag| {
            if tag == "favorite" {
                is_favorite = true;
                false
            } else {
                true
            }
        });

        let updated_tags = serde_json::to_string(&tags)
            .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

        conn.execute(
            "UPDATE datacards SET is_favorite = ?1, tags_json = ?2 WHERE id = ?3",
            rusqlite::params![if is_favorite { 1 } else { 0 }, updated_tags, id],
        )
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;
    }

    conn.execute_batch("PRAGMA user_version = 2;")
        .map_err(|_| ErrorCodeString::new("DB_MIGRATION_FAILED"))?;

    Ok(())
}
