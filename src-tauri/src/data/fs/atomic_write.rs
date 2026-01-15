use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;
use std::time::Duration;
use uuid::Uuid;

/// Atomic file write:
/// - write to temp in same directory
/// - fsync temp
/// - rename current -> backup (if exists)
/// - rename temp -> target
/// - cleanup backup
pub fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    fn rename_with_retry(from: &Path, to: &Path) -> io::Result<()> {
        let mut last: Option<io::Error> = None;
        // Windows часто даёт PermissionDenied если файл ещё открыт (SQLite/AV/indexer).
        // Делаем короткие ретраи.
        for _ in 0..25 {
            match fs::rename(from, to) {
                Ok(()) => return Ok(()),
                Err(e) => {
                    last = Some(e);
                    let kind = last.as_ref().unwrap().kind();
                    if kind != io::ErrorKind::PermissionDenied && kind != io::ErrorKind::Other {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(40));
                }
            }
        }
        Err(last.unwrap_or_else(|| io::Error::new(io::ErrorKind::Other, "rename failed")))
    }

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
            rename_with_retry(path, &bak_path)?;
        }

        // 3) move temp into place
        rename_with_retry(&tmp_path, path)?;

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
