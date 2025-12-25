use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;

use crate::error::{ErrorCodeString, Result};

const DB_POOL_MAX_SIZE_FILE: u32 = 2;
const DB_POOL_MIN_IDLE_FILE: u32 = 0;
const DB_POOL_CONNECTION_TIMEOUT_SECS_FILE: u64 = 10;
const DB_BUSY_TIMEOUT_SECS_FILE: u64 = 15;

#[derive(Clone, Debug)]
pub enum DbTarget {
    File(std::path::PathBuf),
    Uri(String),
}

static POOLS: Lazy<Mutex<HashMap<String, r2d2::Pool<SqliteConnectionManager>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug)]
struct FilePragmas;

impl r2d2::CustomizeConnection<rusqlite::Connection, rusqlite::Error> for FilePragmas {
    fn on_acquire(
        &self,
        conn: &mut rusqlite::Connection,
    ) -> std::result::Result<(), rusqlite::Error> {
        conn.busy_timeout(Duration::from_secs(DB_BUSY_TIMEOUT_SECS_FILE))?;
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA synchronous = NORMAL;
            "#,
        )
    }
}

#[derive(Debug)]
struct MemoryPragmas;

impl r2d2::CustomizeConnection<rusqlite::Connection, rusqlite::Error> for MemoryPragmas {
    fn on_acquire(
        &self,
        conn: &mut rusqlite::Connection,
    ) -> std::result::Result<(), rusqlite::Error> {
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = MEMORY;
            PRAGMA synchronous = NORMAL;
            "#,
        )
    }
}

fn get_or_create_pool(
    profile_id: &str,
    target: DbTarget,
) -> Result<r2d2::Pool<SqliteConnectionManager>> {
    let mut pools = POOLS
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    let key = match &target {
        DbTarget::File(_) => format!("{profile_id}::file"),
        DbTarget::Uri(uri) => format!("{profile_id}::uri::{uri}"),
    };

    log::info!("[DB][pool] profile_id={profile_id} target={target:?} key={key}");

    if let Some(pool) = pools.get(&key) {
        return Ok(pool.clone());
    }

    let pool = match target {
        DbTarget::File(path) => {
            let manager = SqliteConnectionManager::file(path);
            r2d2::Pool::builder()
                .max_size(DB_POOL_MAX_SIZE_FILE)
                .min_idle(Some(DB_POOL_MIN_IDLE_FILE))
                .connection_timeout(Duration::from_secs(DB_POOL_CONNECTION_TIMEOUT_SECS_FILE))
                .connection_customizer(Box::new(FilePragmas))
                .build(manager)
                .map_err(|e| {
                    log::error!("[DB][pool] build failed: {e:?}");
                    ErrorCodeString::new("DB_OPEN_FAILED")
                })?
        }
        DbTarget::Uri(uri) => {
            let flags = rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
                | rusqlite::OpenFlags::SQLITE_OPEN_CREATE
                | rusqlite::OpenFlags::SQLITE_OPEN_URI
                | rusqlite::OpenFlags::SQLITE_OPEN_SHARED_CACHE;
            let manager = SqliteConnectionManager::file(uri).with_flags(flags);
            r2d2::Pool::builder()
                .max_size(DB_POOL_MAX_SIZE_FILE)
                .min_idle(Some(DB_POOL_MIN_IDLE_FILE))
                .connection_timeout(Duration::from_secs(DB_POOL_CONNECTION_TIMEOUT_SECS_FILE))
                .connection_customizer(Box::new(MemoryPragmas))
                .build(manager)
                .map_err(|e| {
                    log::error!("[DB][pool] build failed: {e:?}");
                    ErrorCodeString::new("DB_OPEN_FAILED")
                })?
        }
    };

    pools.insert(key, pool.clone());
    Ok(pool)
}

pub fn get_conn(
    profile_id: &str,
    target: DbTarget,
) -> Result<PooledConnection<SqliteConnectionManager>> {
    let pool = get_or_create_pool(profile_id, target)?;
    pool.get()
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))
}

pub fn clear_pool(profile_id: &str) {
    if let Ok(mut pools) = POOLS.lock() {
        pools.retain(|key, _| !key.starts_with(&format!("{profile_id}::")));
    }
}

pub fn clear_all_pools() {
    if let Ok(mut pools) = POOLS.lock() {
        pools.clear();
    }
}
