use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;

use crate::data::profiles::paths::vault_db_path;
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

static POOLS: Lazy<Mutex<HashMap<String, r2d2::Pool<SqliteConnectionManager>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug)]
struct Pragmas;

impl r2d2::CustomizeConnection<rusqlite::Connection, rusqlite::Error> for Pragmas {
    fn on_acquire(
        &self,
        conn: &mut rusqlite::Connection,
    ) -> std::result::Result<(), rusqlite::Error> {
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            "#,
        )
    }
}

fn get_or_create_pool(
    sp: &StoragePaths,
    profile_id: &str,
) -> Result<r2d2::Pool<SqliteConnectionManager>> {
    let mut pools = POOLS
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    if let Some(pool) = pools.get(profile_id) {
        return Ok(pool.clone());
    }

    let manager = SqliteConnectionManager::file(vault_db_path(sp, profile_id));
    let pool = r2d2::Pool::builder()
        .max_size(8)
        .min_idle(Some(4))
        .connection_timeout(Duration::from_secs(5))
        .connection_customizer(Box::new(Pragmas))
        .build(manager)
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))?;

    pools.insert(profile_id.to_string(), pool.clone());
    Ok(pool)
}

pub fn get_conn(
    sp: &StoragePaths,
    profile_id: &str,
) -> Result<PooledConnection<SqliteConnectionManager>> {
    let pool = get_or_create_pool(sp, profile_id)?;
    pool.get()
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))
}

pub fn clear_pool(profile_id: &str) {
    if let Ok(mut pools) = POOLS.lock() {
        pools.remove(profile_id);
    }
}
