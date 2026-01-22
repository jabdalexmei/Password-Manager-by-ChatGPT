// This module intentionally provides no-op pool invalidation helpers.
//
// Older versions of the app used r2d2 to pool file-backed SQLite connections.
// The current storage model keeps SQLite in memory and persists an encrypted blob (vault.db),
// so there are no file-backed SQLite connections to pool.
//
// We keep these functions because many call sites legitimately want to invalidate any
// cached connections after restore / password transitions.

pub fn clear_pool(_profile_id: &str) {}

pub fn clear_all_pools() {}
