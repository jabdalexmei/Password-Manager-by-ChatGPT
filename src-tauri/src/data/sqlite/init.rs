use rusqlite::Connection;

use crate::data::crypto::cipher::{encrypt_vault_blob, write_encrypted_file};
use crate::data::profiles::paths::{ensure_profile_dirs, vault_db_path};
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};
use rusqlite::DatabaseName;

use super::migrations;

pub fn init_database_passwordless(sp: &StoragePaths, profile_id: &str) -> Result<()> {
    ensure_profile_dirs(sp, profile_id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let conn = Connection::open(vault_db_path(sp, profile_id)?)
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;

    migrations::migrate_to_latest(&conn)?;

    // Set WAL ONCE (DB-file persistent) and avoid doing it in pool connections.
    // WAL persistence is documented by SQLite. :contentReference[oaicite:1]{index=1}
    let current: String = conn
        .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    if current.to_uppercase() != "WAL" {
        // This PRAGMA changes the DB file state; run it only from init, not from r2d2 on_acquire.
        let _: String = conn
            .query_row("PRAGMA journal_mode=WAL;", [], |row| row.get(0))
            .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    }

    Ok(())
}

pub fn init_database_protected_encrypted(
    sp: &StoragePaths,
    profile_id: &str,
    key: &[u8; 32],
) -> Result<()> {
    ensure_profile_dirs(sp, profile_id)
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))?;

    let conn = Connection::open_in_memory().map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;
    migrations::migrate_to_latest(&conn)?;

    let bytes = conn
        .serialize(DatabaseName::Main)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    let encrypted = encrypt_vault_blob(profile_id, key, &bytes)?;
    write_encrypted_file(&vault_db_path(sp, profile_id)?, &encrypted)
}
