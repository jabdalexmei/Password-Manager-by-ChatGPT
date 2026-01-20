use std::fs;

use rand::rngs::OsRng;
use rand::RngCore;
use zeroize::Zeroizing;

use crate::data::crypto::{cipher, dpapi};
use crate::data::fs::atomic_write::write_atomic;
use crate::data::profiles::paths::{dpapi_key_path, vault_key_path};
use crate::data::storage_paths::StoragePaths;
use crate::error::{ErrorCodeString, Result};

pub const MASTER_KEY_LEN: usize = 32;

// Plaintext encoding:
//   "PMMK1:" + profile_id + "\0" + 32-bytes key
// This prevents accidental cross-profile key swaps.
const PREFIX: &[u8] = b"PMMK1:";

pub fn generate_master_key() -> [u8; MASTER_KEY_LEN] {
    let mut key = [0u8; MASTER_KEY_LEN];
    OsRng.fill_bytes(&mut key);
    key
}

fn build_plaintext(profile_id: &str, master_key: &[u8; MASTER_KEY_LEN]) -> Zeroizing<Vec<u8>> {
    let mut out = Vec::with_capacity(PREFIX.len() + profile_id.len() + 1 + MASTER_KEY_LEN);
    out.extend_from_slice(PREFIX);
    out.extend_from_slice(profile_id.as_bytes());
    out.push(0);
    out.extend_from_slice(master_key);
    Zeroizing::new(out)
}

fn parse_plaintext(profile_id: &str, plaintext: &[u8]) -> Result<[u8; MASTER_KEY_LEN]> {
    if !plaintext.starts_with(PREFIX) {
        return Err(ErrorCodeString::new("MASTER_KEY_CORRUPTED"));
    }
    let rest = &plaintext[PREFIX.len()..];
    let nul = rest
        .iter()
        .position(|b| *b == 0)
        .ok_or_else(|| ErrorCodeString::new("MASTER_KEY_CORRUPTED"))?;
    let pid = &rest[..nul];
    if pid != profile_id.as_bytes() {
        return Err(ErrorCodeString::new("MASTER_KEY_PROFILE_MISMATCH"));
    }
    let key_bytes = &rest[nul + 1..];
    if key_bytes.len() != MASTER_KEY_LEN {
        return Err(ErrorCodeString::new("MASTER_KEY_CORRUPTED"));
    }
    let mut key = [0u8; MASTER_KEY_LEN];
    key.copy_from_slice(key_bytes);
    Ok(key)
}

fn aad(profile_id: &str) -> Vec<u8> {
    format!("master_key:{}", profile_id).into_bytes()
}

pub fn write_master_key_wrapped_with_password(
    sp: &StoragePaths,
    profile_id: &str,
    wrapping_key: &[u8; MASTER_KEY_LEN],
    master_key: &[u8; MASTER_KEY_LEN],
) -> Result<()> {
    let plaintext = build_plaintext(profile_id, master_key);
    let blob = cipher::encrypt_bytes(wrapping_key, &aad(profile_id), plaintext.as_slice())?;
    cipher::write_encrypted_file(&vault_key_path(sp, profile_id)?, &blob)
}

pub fn read_master_key_wrapped_with_password(
    sp: &StoragePaths,
    profile_id: &str,
    wrapping_key: &[u8; MASTER_KEY_LEN],
) -> Result<[u8; MASTER_KEY_LEN]> {
    let blob = cipher::read_encrypted_file(&vault_key_path(sp, profile_id)?)?;
    let plaintext = cipher::decrypt_bytes(wrapping_key, &aad(profile_id), &blob)?;
    parse_plaintext(profile_id, &plaintext)
}

pub fn read_master_key_wrapped_with_dpapi(
    sp: &StoragePaths,
    profile_id: &str,
) -> Result<[u8; MASTER_KEY_LEN]> {
    let path = dpapi_key_path(sp, profile_id)?;
    if !path.exists() {
        return Err(ErrorCodeString::new("DPAPI_KEY_MISSING"));
    }
    let protected = fs::read(&path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;
    let plaintext = dpapi::unprotect(&protected, Some(profile_id.as_bytes()))?;
    parse_plaintext(profile_id, &plaintext)
}

/// Passwordless portable mode: store the master key *unwrapped* in vault_key.bin.
///
/// SECURITY NOTE:
/// This intentionally lowers security: anyone who can read the profile folder / backup can unlock the vault.
/// This is by design for the "passwordless but portable" mode.
pub fn write_master_key_unwrapped(
    sp: &StoragePaths,
    profile_id: &str,
    master_key: &[u8; MASTER_KEY_LEN],
) -> Result<()> {
    let plaintext = build_plaintext(profile_id, master_key);
    write_atomic(&vault_key_path(sp, profile_id)?, plaintext.as_slice())
        .map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_WRITE"))
}

pub fn read_master_key_unwrapped(
    sp: &StoragePaths,
    profile_id: &str,
) -> Result<[u8; MASTER_KEY_LEN]> {
    let path = vault_key_path(sp, profile_id)?;
    if !path.exists() {
        return Err(ErrorCodeString::new("VAULT_KEY_MISSING"));
    }

    let bytes = fs::read(&path).map_err(|_| ErrorCodeString::new("PROFILE_STORAGE_READ"))?;

    // If vault_key.bin looks like our encrypted file format, then this isn't passwordless.
    if bytes.starts_with(&cipher::PM_ENC_MAGIC) {
        return Err(ErrorCodeString::new("PASSWORD_REQUIRED"));
    }

    parse_plaintext(profile_id, &bytes)
}

/// Read passwordless master key in the current (portable) format.
///
/// Backwards-compatibility:
/// If vault_key.bin doesn't exist yet, we try legacy dpapi_key.bin (Windows only),
/// and migrate it to portable vault_key.bin.
pub fn read_master_key_passwordless_portable(
    sp: &StoragePaths,
    profile_id: &str,
) -> Result<[u8; MASTER_KEY_LEN]> {
    match read_master_key_unwrapped(sp, profile_id) {
        Ok(key) => Ok(key),
        Err(e) => {
            // Only attempt DPAPI migration when the portable file is missing.
            if e.code != "VAULT_KEY_MISSING" {
                return Err(e);
            }

            let key = read_master_key_wrapped_with_dpapi(sp, profile_id)?;

            // Best-effort migration to portable format.
            let _ = write_master_key_unwrapped(sp, profile_id, &key);
            if let Ok(p) = dpapi_key_path(sp, profile_id) {
                let _ = fs::remove_file(p);
            }

            Ok(key)
        }
    }
}
