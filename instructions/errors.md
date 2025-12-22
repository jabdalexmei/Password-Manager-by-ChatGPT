One TS (EN): Fix build error by removing anyhow usage in security_service.rs
Goal

Fix Rust compilation errors related to missing anyhow crate by aligning the helper function with the project’s existing error type crate::error::Result<T>.

File

src-tauri/src/services/security_service.rs

Required change
1) Replace helper signature and error construction

Find and replace this function:

Before

fn owned_data_from_bytes(bytes: Vec<u8>) -> anyhow::Result<OwnedData> {
    if bytes.is_empty() {
        return Err(anyhow::anyhow!("EMPTY_SERIALIZED_DB"));
    }

    let sz = bytes.len();
    let ptr = unsafe { ffi::sqlite3_malloc64(sz as u64) as *mut u8 };

    let nn = NonNull::new(ptr).ok_or_else(|| anyhow::anyhow!("SQLITE_OOM"))?;

    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), nn.as_ptr(), sz);
        Ok(OwnedData::from_raw_nonnull(nn, sz))
    }
}


After

fn owned_data_from_bytes(bytes: Vec<u8>) -> Result<OwnedData> {
    if bytes.is_empty() {
        return Err(ErrorCodeString::new("EMPTY_SERIALIZED_DB"));
    }

    let sz = bytes.len();
    let ptr = unsafe { ffi::sqlite3_malloc64(sz as u64) as *mut u8 };

    let nn = NonNull::new(ptr).ok_or_else(|| ErrorCodeString::new("SQLITE_OOM"))?;

    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), nn.as_ptr(), sz);
        Ok(OwnedData::from_raw_nonnull(nn, sz))
    }
}

2) Update the call site (optional simplification)

You currently have:

let owned =
    owned_data_from_bytes(decrypted).map_err(|_| ErrorCodeString::new("VAULT_CORRUPTED"))?;


This can stay as-is (it will compile), or be simplified to:

let owned = owned_data_from_bytes(decrypted)?;

Acceptance criteria

cargo build succeeds in src-tauri without anyhow-related errors.
