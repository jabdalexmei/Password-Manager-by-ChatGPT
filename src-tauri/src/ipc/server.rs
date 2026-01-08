use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::borrow::Cow;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::app_state::AppState;
use crate::error::{ErrorCodeString, Result};
use crate::ipc::registry::{remove_ipc_info, write_ipc_info, NativeHostIpcInfo};
use crate::services::{datacards_service, profiles_service, security_service};

const MAX_FRAME_LEN: usize = 1024 * 1024; // 1MB

#[derive(Debug, Serialize, Deserialize)]
pub struct BridgeRequest {
    pub id: String,
    pub token: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BridgeError {
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BridgeResponse {
    pub id: String,
    pub ok: bool,
    pub result: Option<Value>,
    pub error: Option<BridgeError>,
}

#[derive(Debug, Deserialize)]
struct ProfileIdPayload {
    #[serde(rename = "profileId")]
    profile_id: String,
}

#[derive(Debug, Deserialize)]
struct ListCredentialsPayload {
    #[serde(rename = "profileId")]
    profile_id: String,
    origin: String,
}

#[derive(Debug, Deserialize)]
struct GetCredentialPayload {
    #[serde(rename = "profileId")]
    profile_id: String,
    origin: String,
    #[serde(rename = "credentialId")]
    credential_id: String,
}

#[derive(Debug, Serialize)]
struct ListProfilesResult {
    profiles: Vec<crate::types::ProfileMeta>,
}

#[derive(Debug, Serialize)]
struct StatusResult {
    locked: bool,
}

#[derive(Debug, Serialize)]
struct CredentialListItem {
    id: String,
    username: String,
    title: String,
}

#[derive(Debug, Serialize)]
struct ListCredentialsResult {
    items: Vec<CredentialListItem>,
}

#[derive(Debug, Serialize)]
struct CredentialForFillResult {
    username: String,
    password: String,
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn read_frame(mut stream: &TcpStream) -> Result<Option<Vec<u8>>> {
    let mut len_bytes = [0u8; 4];
    match stream.read_exact(&mut len_bytes) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(_) => return Err(ErrorCodeString::new("IPC_STREAM_READ_FAILED")),
    }

    let len = u32::from_ne_bytes(len_bytes) as usize;
    if len == 0 || len > MAX_FRAME_LEN {
        return Err(ErrorCodeString::new("IPC_FRAME_INVALID"));
    }
    let mut buf = vec![0u8; len];
    stream
        .read_exact(&mut buf)
        .map_err(|_| ErrorCodeString::new("IPC_STREAM_READ_FAILED"))?;
    Ok(Some(buf))
}

fn write_frame(mut stream: &TcpStream, bytes: &[u8]) -> Result<()> {
    if bytes.is_empty() || bytes.len() > MAX_FRAME_LEN {
        return Err(ErrorCodeString::new("IPC_FRAME_INVALID"));
    }
    let len = bytes.len() as u32;
    stream
        .write_all(&len.to_ne_bytes())
        .map_err(|_| ErrorCodeString::new("IPC_STREAM_WRITE_FAILED"))?;
    stream
        .write_all(bytes)
        .map_err(|_| ErrorCodeString::new("IPC_STREAM_WRITE_FAILED"))?;
    stream.flush().ok();
    Ok(())
}

fn parse_origin(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(ErrorCodeString::new("INVALID_ORIGIN"));
    }

    // Accept:
    // - origin: https://example.com
    // - full URL: https://example.com/path
    // - bare host: example.com (we treat as https://example.com)
    let work: Cow<'_, str> = if trimmed.contains("://") {
        Cow::Borrowed(trimmed)
    } else if trimmed.starts_with("//") {
        Cow::Owned(format!("https:{}", trimmed))
    } else {
        Cow::Owned(format!("https://{}", trimmed))
    };

    let scheme_split = work
        .find("://")
        .ok_or_else(|| ErrorCodeString::new("INVALID_ORIGIN"))?;

    let scheme = work[..scheme_split].to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return Err(ErrorCodeString::new("INVALID_ORIGIN"));
    }

    let rest = &work[(scheme_split + 3)..];
    let host_port = rest
        .split(|c| c == '/' || c == '?' || c == '#')
        .next()
        .unwrap_or("")
        .trim();

    if host_port.is_empty() {
        return Err(ErrorCodeString::new("INVALID_ORIGIN"));
    }

    let (host, port_opt) = match host_port.rsplit_once(':') {
        Some((h, p)) if !h.is_empty() && p.chars().all(|c| c.is_ascii_digit()) => {
            let port: u16 = p.parse().map_err(|_| ErrorCodeString::new("INVALID_ORIGIN"))?;
            (h, Some(port))
        }
        _ => (host_port, None),
    };

    let host = host.to_ascii_lowercase();
    let default_port = if scheme == "http" { 80 } else { 443 };

    match port_opt {
        Some(port) if port != default_port => Ok(format!("{scheme}://{host}:{port}")),
        _ => Ok(format!("{scheme}://{host}")),
    }
}

#[derive(Clone, Copy)]
struct OriginParts<'a> {
    scheme: &'a str,
    host: &'a str,
    port: u16,
}

fn origin_parts(origin: &str) -> Option<OriginParts<'_>> {
    let scheme_split = origin.find("://")?;
    let scheme = &origin[..scheme_split];
    let rest = &origin[(scheme_split + 3)..];

    // We only expect normal hostnames here (no IPv6 literal).
    if rest.starts_with('[') {
        return None;
    }

    let default_port = if scheme == "http" { 80 } else { 443 };
    let (host, port) = match rest.rsplit_once(':') {
        Some((h, p)) if !h.is_empty() && p.chars().all(|c| c.is_ascii_digit()) => {
            let port: u16 = p.parse().ok()?;
            (h, port)
        }
        _ => (rest, default_port),
    };

    Some(OriginParts {
        scheme,
        host,
        port,
    })
}

fn strip_www(host: &str) -> &str {
    host.strip_prefix("www.").unwrap_or(host)
}

fn is_same_or_subdomain(host: &str, base: &str) -> bool {
    if host == base {
        return true;
    }
    if host.len() <= base.len() {
        return false;
    }
    // Must end with ".<base>", not just "<base>" (prevents "evil-soundcloud.com" matching "soundcloud.com").
    let dot_pos = host.len() - base.len() - 1;
    host.as_bytes().get(dot_pos) == Some(&b'.') && host.ends_with(base)
}

fn origin_matches_url(card_url: &str, requested_origin: &str) -> bool {
    let Ok(card_origin) = parse_origin(card_url) else { return false; };
    if card_origin == requested_origin {
        return true;
    }

    let Some(req) = origin_parts(requested_origin) else { return false; };
    let Some(card) = origin_parts(&card_origin) else { return false; };
    if req.scheme != card.scheme || req.port != card.port {
        return false;
    }

    let req_host = strip_www(req.host);
    let card_base = strip_www(card.host);
    is_same_or_subdomain(req_host, card_base)
}

fn datacard_origin(url: &str) -> Option<String> {
    parse_origin(url).ok()
}

fn error_response(id: String, code: &str) -> BridgeResponse {
    BridgeResponse {
        id,
        ok: false,
        result: None,
        error: Some(BridgeError {
            code: code.to_string(),
        }),
    }
}

fn ok_response(id: String, value: Value) -> BridgeResponse {
    BridgeResponse {
        id,
        ok: true,
        result: Some(value),
        error: None,
    }
}

fn handle_request(state: &Arc<AppState>, shared_token: &str, req: BridgeRequest) -> BridgeResponse {
    if req.token != shared_token {
        return error_response(req.id, "UNAUTHORIZED");
    }

    let result: Result<Value> = (|| {
        match req.kind.as_str() {
            "ping" => Ok(serde_json::json!({"ok": true})),
            "list_profiles" => {
                let sp = state.get_storage_paths()?;
                let list = profiles_service::list_profiles(&sp)?;
                Ok(serde_json::to_value(ListProfilesResult {
                    profiles: list.profiles,
                })
                .map_err(|_| ErrorCodeString::new("IPC_SERIALIZE_FAILED"))?)
            }
            "get_status" => {
                let payload: ProfileIdPayload = serde_json::from_value(req.payload)
                    .map_err(|_| ErrorCodeString::new("IPC_BAD_PAYLOAD"))?;

                let active = state
                    .active_profile
                    .lock()
                    .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
                    .clone();

                let locked = match active {
                    Some(id) if id == payload.profile_id => !security_service::is_logged_in(state)?,
                    _ => true,
                };

                Ok(serde_json::to_value(StatusResult { locked })
                    .map_err(|_| ErrorCodeString::new("IPC_SERIALIZE_FAILED"))?)
            }
            "list_credentials" => {
                let payload: ListCredentialsPayload = serde_json::from_value(req.payload)
                    .map_err(|_| ErrorCodeString::new("IPC_BAD_PAYLOAD"))?;

                let origin = parse_origin(&payload.origin)?;

                let active = security_service::require_unlocked_active_profile(state)
                    .map_err(|_| ErrorCodeString::new("LOCKED"))?;
                if active.profile_id != payload.profile_id {
                    return Err(ErrorCodeString::new("LOCKED"));
                }

                let rows = datacards_service::list_datacards_summary(state)?;

                let mut items: Vec<CredentialListItem> = Vec::new();
                for row in rows {
                    let Some(url) = row.url.as_deref() else { continue };
                    if !origin_matches_url(url, &origin) { continue; }
                    let username = row
                        .email
                        .clone()
                        .or(row.username.clone())
                        .unwrap_or_default();
                    if username.trim().is_empty() {
                        continue;
                    }
                    items.push(CredentialListItem {
                        id: row.id,
                        username,
                        title: row.title,
                    });
                }

                Ok(serde_json::to_value(ListCredentialsResult { items })
                    .map_err(|_| ErrorCodeString::new("IPC_SERIALIZE_FAILED"))?)
            }
            "get_credential_for_fill" => {
                let payload: GetCredentialPayload = serde_json::from_value(req.payload)
                    .map_err(|_| ErrorCodeString::new("IPC_BAD_PAYLOAD"))?;

                let origin = parse_origin(&payload.origin)?;

                let active = security_service::require_unlocked_active_profile(state)
                    .map_err(|_| ErrorCodeString::new("LOCKED"))?;
                if active.profile_id != payload.profile_id {
                    return Err(ErrorCodeString::new("LOCKED"));
                }

                let card = datacards_service::get_datacard(payload.credential_id, state)?;
                let Some(url) = card.url.as_deref() else {
                    return Err(ErrorCodeString::new("CREDENTIAL_URL_MISSING"));
                };
                if !origin_matches_url(url, &origin) {
                    return Err(ErrorCodeString::new("ORIGIN_MISMATCH"));
                }

                let username = card
                    .email
                    .clone()
                    .or(card.username.clone())
                    .unwrap_or_default();
                let password = card.password.clone().unwrap_or_default();

                if username.trim().is_empty() {
                    return Err(ErrorCodeString::new("USERNAME_MISSING"));
                }
                if password.trim().is_empty() {
                    return Err(ErrorCodeString::new("PASSWORD_MISSING"));
                }

                Ok(serde_json::to_value(CredentialForFillResult { username, password })
                    .map_err(|_| ErrorCodeString::new("IPC_SERIALIZE_FAILED"))?)
            }
            _ => Err(ErrorCodeString::new("IPC_UNKNOWN_REQUEST")),
        }
    })();

    match result {
        Ok(val) => ok_response(req.id, val),
        Err(err) => error_response(req.id, &err.code),
    }
}

fn handle_client(stream: TcpStream, state: Arc<AppState>, token: String) {
    loop {
        let frame = match read_frame(&stream) {
            Ok(Some(bytes)) => bytes,
            Ok(None) => break,
            Err(_) => break,
        };
        let req: BridgeRequest = match serde_json::from_slice(&frame) {
            Ok(v) => v,
            Err(_) => {
                // Can't decode, give up silently.
                break;
            }
        };

        let resp = handle_request(&state, &token, req);
        if let Ok(bytes) = serde_json::to_vec(&resp) {
            let _ = write_frame(&stream, &bytes);
        } else {
            break;
        }
    }
}

pub fn start_native_bridge(state: Arc<AppState>) -> Result<()> {
    // Ensure we clean up any stale file from prior crashes.
    {
        let sp = state
            .storage_paths
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .clone();
        remove_ipc_info(sp.app_dir());
    }

    let listener =
        TcpListener::bind(("127.0.0.1", 0)).map_err(|_| ErrorCodeString::new("IPC_BIND_FAILED"))?;
    let port = listener
        .local_addr()
        .map_err(|_| ErrorCodeString::new("IPC_BIND_FAILED"))?
        .port();

    let token = Uuid::new_v4().to_string();

    let app_dir = {
        let sp = state
            .storage_paths
            .lock()
            .map_err(|_| ErrorCodeString::new("STATE_UNAVAILABLE"))?
            .clone();
        sp.app_dir().to_path_buf()
    };

    let info = NativeHostIpcInfo {
        schema_version: 1,
        port,
        token: token.clone(),
        created_at_ms: now_ms(),
    };
    let written_to = match write_ipc_info(&app_dir, &info) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[IPC] write_ipc_info failed: {}", e.code);
            return Err(e);
        }
    };
    eprintln!("[IPC] native-host.json written: {}", written_to.display());

    thread::spawn(move || {
        for incoming in listener.incoming() {
            match incoming {
                Ok(stream) => {
                    let st = state.clone();
                    let t = token.clone();
                    thread::spawn(move || handle_client(stream, st, t));
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}
