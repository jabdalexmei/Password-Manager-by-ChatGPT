use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;
use uuid::Uuid;

/// Atomic file write:
/// - write to temp in same directory
/// - fsync temp
/// - rename current -> backup (if exists)
/// - rename temp -> target
/// - cleanup backup
pub fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "write_atomic: path has no parent")
    })?;
    fs::create_dir_all(parent)?;

    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let tmp_path = parent.join(format!(".{}.tmp.{}", file_name, Uuid::new_v4()));
    let bak_path = parent.join(format!(".{}.bak.{}", file_name, Uuid::new_v4()));

    let result: io::Result<()> = (|| {
        // 1) write temp
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);

        // 2) move current to backup (if exists)
        if path.exists() {
            fs::rename(path, &bak_path)?;
        }

        // 3) move temp into place
        fs::rename(&tmp_path, path)?;

        // 4) remove backup
        if bak_path.exists() {
            let _ = fs::remove_file(&bak_path);
        }

        Ok(())
    })();

    // Best-effort cleanup/rollback
    if result.is_err() {
        let _ = fs::remove_file(&tmp_path);
        if bak_path.exists() && !path.exists() {
            let _ = fs::rename(&bak_path, path);
        }
    }

    result
}
