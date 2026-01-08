use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};

const MAX_FRAME_LEN: usize = 1024 * 1024; // 1MB

#[derive(Debug, Deserialize)]
struct NativeRequest {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct NativeError {
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct NativeResponse {
    pub id: String,
    pub ok: bool,
    pub result: Option<Value>,
    pub error: Option<NativeError>,
}

#[derive(Debug, Deserialize)]
struct IpcInfo {
    pub schema_version: u8,
    pub port: u16,
    pub token: String,
    pub created_at_ms: u128,
}

fn primary_ipc_info_path(app_dir: &Path) -> PathBuf {
    app_dir.join("native-host.json")
}

fn fallback_ipc_info_path() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|dir| dir.join("Password Manager").join("native-host.json"))
}

fn ipc_info_path_for_load(app_dir: &Path) -> PathBuf {
    let primary = primary_ipc_info_path(app_dir);
    if primary.exists() {
        return primary;
    }
    if let Some(fallback) = fallback_ipc_info_path() {
        if fallback.exists() {
            return fallback;
        }
    }
    primary
}

fn load_ipc_info(app_dir: &Path) -> Option<IpcInfo> {
    let path = ipc_info_path_for_load(app_dir);
    let content = std::fs::read_to_string(path).ok()?;
    let info: IpcInfo = serde_json::from_str(&content).ok()?;
    if info.schema_version != 1 {
        return None;
    }
    Some(info)
}

fn read_frame<R: Read>(mut r: R) -> std::io::Result<Option<Vec<u8>>> {
    let mut len_bytes = [0u8; 4];
    match r.read_exact(&mut len_bytes) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(err) => return Err(err),
    }
    let len = u32::from_ne_bytes(len_bytes) as usize;
    if len == 0 || len > MAX_FRAME_LEN {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "invalid frame length",
        ));
    }
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)?;
    Ok(Some(buf))
}

fn write_frame<W: Write>(mut w: W, bytes: &[u8]) -> std::io::Result<()> {
    if bytes.is_empty() || bytes.len() > MAX_FRAME_LEN {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "invalid frame length",
        ));
    }
    let len = bytes.len() as u32;
    w.write_all(&len.to_ne_bytes())?;
    w.write_all(bytes)?;
    w.flush()?;
    Ok(())
}

fn error_response(id: String, code: &str) -> NativeResponse {
    NativeResponse {
        id,
        ok: false,
        result: None,
        error: Some(NativeError {
            code: code.to_string(),
        }),
    }
}

fn forward_to_app(req: NativeRequest) -> NativeResponse {
    let app_dir = match std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
    {
        Some(d) => d,
        None => return error_response(req.id, "APP_DIR_UNAVAILABLE"),
    };

    let info = match load_ipc_info(&app_dir) {
        Some(v) => v,
        None => return error_response(req.id, "APP_NOT_RUNNING"),
    };

    let mut stream = match TcpStream::connect(("127.0.0.1", info.port)) {
        Ok(s) => s,
        Err(_) => return error_response(req.id, "APP_NOT_RUNNING"),
    };

    let bridge_req = serde_json::json!({
        "id": req.id,
        "token": info.token,
        "type": req.kind,
        "payload": req.payload,
    });

    let bytes = match serde_json::to_vec(&bridge_req) {
        Ok(b) => b,
        Err(_) => return error_response("unknown".to_string(), "SERIALIZE_FAILED"),
    };

    if write_frame(&mut stream, &bytes).is_err() {
        return error_response("unknown".to_string(), "APP_NOT_RUNNING");
    }
    let frame = match read_frame(&mut stream) {
        Ok(Some(b)) => b,
        _ => return error_response("unknown".to_string(), "APP_NOT_RUNNING"),
    };

    match serde_json::from_slice::<NativeResponse>(&frame) {
        Ok(resp) => resp,
        Err(_) => error_response("unknown".to_string(), "APP_PROTOCOL_ERROR"),
    }
}

fn main() {
    let stdin = std::io::stdin();
    let mut input = stdin.lock();
    let stdout = std::io::stdout();
    let mut output = stdout.lock();

    while let Ok(Some(frame)) = read_frame(&mut input) {
        let req: NativeRequest = match serde_json::from_slice(&frame) {
            Ok(v) => v,
            Err(_) => {
                // Can't decode incoming request; ignore.
                continue;
            }
        };

        let resp = forward_to_app(req);
        if let Ok(bytes) = serde_json::to_vec(&resp) {
            let _ = write_frame(&mut output, &bytes);
        }
    }
}
