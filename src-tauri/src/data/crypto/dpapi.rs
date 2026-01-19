use crate::error::{ErrorCodeString, Result};

/// Windows DPAPI wrapper (CryptProtectData / CryptUnprotectData).
///
/// Always uses `CRYPTPROTECT_UI_FORBIDDEN` to prevent any UI prompt.
///
/// The optional `entropy` is additional authenticated data for DPAPI. We use it
/// (e.g., profile_id bytes) to make accidental file swaps fail early.
#[cfg(windows)]
mod imp {
    use super::*;
    use std::ptr;

    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, DATA_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };
    use windows_sys::Win32::System::Memory::LocalFree;

    fn blob_from_slice(bytes: &[u8]) -> DATA_BLOB {
        DATA_BLOB {
            cbData: bytes.len() as u32,
            pbData: bytes.as_ptr() as *mut u8,
        }
    }

    pub fn protect(plaintext: &[u8], entropy: Option<&[u8]>) -> Result<Vec<u8>> {
        unsafe {
            let mut in_blob = blob_from_slice(plaintext);
            let mut out_blob = DATA_BLOB {
                cbData: 0,
                pbData: ptr::null_mut(),
            };

            let mut ent_blob = DATA_BLOB {
                cbData: 0,
                pbData: ptr::null_mut(),
            };
            let ent_ptr: *mut DATA_BLOB = match entropy {
                Some(e) if !e.is_empty() => {
                    ent_blob = blob_from_slice(e);
                    &mut ent_blob as *mut DATA_BLOB
                }
                _ => ptr::null_mut(),
            };

            let ok = CryptProtectData(
                &mut in_blob as *mut DATA_BLOB,
                ptr::null(),
                ent_ptr,
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob as *mut DATA_BLOB,
            );

            if ok == 0 {
                return Err(ErrorCodeString::new("DPAPI_PROTECT_FAILED"));
            }

            let out =
                std::slice::from_raw_parts(out_blob.pbData as *const u8, out_blob.cbData as usize)
                    .to_vec();
            let _ = LocalFree(out_blob.pbData as isize);
            Ok(out)
        }
    }

    pub fn unprotect(ciphertext: &[u8], entropy: Option<&[u8]>) -> Result<Vec<u8>> {
        unsafe {
            let mut in_blob = blob_from_slice(ciphertext);
            let mut out_blob = DATA_BLOB {
                cbData: 0,
                pbData: ptr::null_mut(),
            };

            let mut ent_blob = DATA_BLOB {
                cbData: 0,
                pbData: ptr::null_mut(),
            };
            let ent_ptr: *mut DATA_BLOB = match entropy {
                Some(e) if !e.is_empty() => {
                    ent_blob = blob_from_slice(e);
                    &mut ent_blob as *mut DATA_BLOB
                }
                _ => ptr::null_mut(),
            };

            let ok = CryptUnprotectData(
                &mut in_blob as *mut DATA_BLOB,
                ptr::null_mut(),
                ent_ptr,
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob as *mut DATA_BLOB,
            );

            if ok == 0 {
                return Err(ErrorCodeString::new("DPAPI_UNPROTECT_FAILED"));
            }

            let out =
                std::slice::from_raw_parts(out_blob.pbData as *const u8, out_blob.cbData as usize)
                    .to_vec();
            let _ = LocalFree(out_blob.pbData as isize);
            Ok(out)
        }
    }
}

#[cfg(windows)]
pub fn protect(plaintext: &[u8], entropy: Option<&[u8]>) -> Result<Vec<u8>> {
    imp::protect(plaintext, entropy)
}

#[cfg(windows)]
pub fn unprotect(ciphertext: &[u8], entropy: Option<&[u8]>) -> Result<Vec<u8>> {
    imp::unprotect(ciphertext, entropy)
}

#[cfg(not(windows))]
pub fn protect(_plaintext: &[u8], _entropy: Option<&[u8]>) -> Result<Vec<u8>> {
    Err(ErrorCodeString::new("WINDOWS_ONLY"))
}

#[cfg(not(windows))]
pub fn unprotect(_ciphertext: &[u8], _entropy: Option<&[u8]>) -> Result<Vec<u8>> {
    Err(ErrorCodeString::new("WINDOWS_ONLY"))
}
