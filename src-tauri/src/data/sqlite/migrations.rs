use crate::error::Result;

/// Placeholder for future migrations. Currently schema is applied in init_database.
pub fn run_pending_migrations(_profile_id: &str) -> Result<()> {
    Ok(())
}
