use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};

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
}

static POOLS: Lazy<Mutex<HashMap<String, r2d2::Pool<SqliteConnectionManager>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static MAINTENANCE: Lazy<Mutex<HashSet<String>>> =
    Lazy::new(|| Mutex::new(HashSet::new()));

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

fn get_or_create_pool(
    profile_id: &str,
    target: DbTarget,
) -> Result<r2d2::Pool<SqliteConnectionManager>> {
    let mut pools = POOLS
        .lock()
        .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;

    let key = format!("{profile_id}::file");

    log::info!("[DB][pool] profile_id={profile_id} target={target:?} key={key}");

    if let Ok(m) = MAINTENANCE.lock() {
        if m.contains(profile_id) {
            log::warn!("[DB][pool] profile_id={profile_id} is in maintenance");
            return Err(ErrorCodeString::new("DB_MAINTENANCE"));
        }
    }

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
    };

    pools.insert(key, pool.clone());
    Ok(pool)
}

pub fn get_conn(
    profile_id: &str,
    target: DbTarget,
) -> Result<PooledConnection<SqliteConnectionManager>> {
    if let Ok(m) = MAINTENANCE.lock() {
        if m.contains(profile_id) {
            return Err(ErrorCodeString::new("DB_MAINTENANCE"));
        }
    }
    let pool = get_or_create_pool(profile_id, target)?;
    pool.get()
        .map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))
}

pub struct MaintenanceGuard {
    profile_id: String,
}

impl MaintenanceGuard {
    pub fn new(profile_id: &str) -> Result<Self> {
        let mut m = MAINTENANCE
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?;
        m.insert(profile_id.to_string());
        Ok(Self {
            profile_id: profile_id.to_string(),
        })
    }
}

impl Drop for MaintenanceGuard {
    fn drop(&mut self) {
        if let Ok(mut m) = MAINTENANCE.lock() {
            m.remove(&self.profile_id);
        }
    }
}

pub fn clear_pool(profile_id: &str) {
    if let Ok(mut pools) = POOLS.lock() {
        pools.retain(|key, _| !key.starts_with(&format!("{profile_id}::")));
    }
}

pub fn drain_and_drop_profile_pools(profile_id: &str, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    loop {
        let pools = match POOLS.lock() {
            Ok(guard) => guard
                .iter()
                .filter_map(|(key, pool)| {
                    if key.starts_with(&format!("{profile_id}::")) {
                        Some(pool.clone())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>(),
            Err(_) => return,
        };

        let all_idle = pools.iter().all(|pool| {
            let state = pool.state();
            state.connections == state.idle_connections
        });

        if all_idle || Instant::now() >= deadline {
            break;
        }

        std::thread::sleep(Duration::from_millis(50));
    }

    clear_pool(profile_id);
}

pub fn clear_all_pools() {
    if let Ok(mut pools) = POOLS.lock() {
        pools.clear();
    }
}
