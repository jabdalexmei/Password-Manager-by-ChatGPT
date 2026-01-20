use std::collections::HashMap;
use std::sync::Mutex;

use once_cell::sync::Lazy;
use r2d2_sqlite::SqliteConnectionManager;

// NOTE:
// This crate keeps the "pool" module because older versions used r2d2 to manage
// file-backed SQLite connections. The current storage model keeps SQLite in
// memory and persists an encrypted blob (`vault.db`), so there are no longer
// on-disk SQLite connections to pool.
//
// We still keep a minimal pool registry so callers can invalidate any pooled
// connections if this changes again in the future.

static POOLS: Lazy<Mutex<HashMap<String, r2d2::Pool<SqliteConnectionManager>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

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
