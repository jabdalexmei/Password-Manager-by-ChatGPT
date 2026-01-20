use crate::error::{ErrorCodeString, Result};

/// Windows DPAPI wrapper (CryptUnprotectData).
///
/// Always uses `CRYPTPROTECT_UI_FORBIDDEN` to prevent any UI prompt.
///
/// The optional `entropy` is additional authenticated data for DPAPI. We use it
/// (e.g., profile_id bytes) to make accidental file swaps fail early.
///
/// NOTE:
/// We only keep the *unprotect* direction. New passwordless profiles are
/// portable and store the master key in `vault_key.bin` (unwrapped), so we no
/// longer need to *protect* data via DPAPI for newly created profiles.
///
/// We still use DPAPI unprotect for backwards-compatibility when restoring
/// legacy passwordless profiles that used `dpapi_key.bin`.
#[cfg(windows)]
mod imp {
    use super::*;
    use core::ffi::c_void;
    use std::mem::MaybeUninit;
    use std::ptr;

    // windows-sys does not always expose the `DATA_BLOB` alias name.
    // In Win32 headers, `DATA_BLOB` is just an alias of `_CRYPTOAPI_BLOB` (aka
    // `CRYPT_INTEGER_BLOB`). We use `CRYPT_INTEGER_BLOB` to keep this compatible
    // across windows-sys versions.
    //
    // Ref: in Win32 headers `DATA_BLOB` is an alias of `_CRYPTOAPI_BLOB`.
    // (see the `CRYPT_INTEGER_BLOB`/`_CRYPTOAPI_BLOB` family of aliases).
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    // `LocalFree` is exposed from Win32 Foundation in windows-sys.
    use windows_sys::Win32::Foundation::LocalFree;

    type DataBlob = CRYPT_INTEGER_BLOB;

    fn blob_from_slice(bytes: &[u8]) -> DataBlob {
        DataBlob {
            cbData: bytes.len() as u32,
            pbData: bytes.as_ptr() as *mut u8,
        }
    }

    pub fn unprotect(ciphertext: &[u8], entropy: Option<&[u8]>) -> Result<Vec<u8>> {
        unsafe {
            let mut in_blob = blob_from_slice(ciphertext);
            let mut out_blob = DataBlob {
                cbData: 0,
                pbData: ptr::null_mut(),
            };

            let mut ent_blob = MaybeUninit::<DataBlob>::uninit();
            let ent_ptr: *mut DataBlob = match entropy {
                Some(e) if !e.is_empty() => {
                    ent_blob.write(blob_from_slice(e));
                    ent_blob.as_mut_ptr()
                }
                _ => ptr::null_mut(),
            };

            let ok = CryptUnprotectData(
                &mut in_blob as *mut DataBlob,
                ptr::null_mut(),
                ent_ptr,
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob as *mut DataBlob,
            );

            if ok == 0 {
                return Err(ErrorCodeString::new("DPAPI_UNPROTECT_FAILED"));
            }

            let out =
                std::slice::from_raw_parts(out_blob.pbData as *const u8, out_blob.cbData as usize)
                    .to_vec();
            let _ = LocalFree(out_blob.pbData as *mut c_void);
            Ok(out)
        }
    }
}

#[cfg(windows)]
pub fn unprotect(ciphertext: &[u8], entropy: Option<&[u8]>) -> Result<Vec<u8>> {
    imp::unprotect(ciphertext, entropy)
}

#[cfg(not(windows))]
pub fn unprotect(_ciphertext: &[u8], _entropy: Option<&[u8]>) -> Result<Vec<u8>> {
    Err(ErrorCodeString::new("WINDOWS_ONLY"))
}
