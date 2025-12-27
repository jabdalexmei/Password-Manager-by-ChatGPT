#[cfg(target_os = "windows")]
use std::time::Duration;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{GetLastError, BOOL};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

/// Clears the entire Windows clipboard (all formats).
/// Uses OpenClipboard -> EmptyClipboard -> CloseClipboard.
/// Retries because clipboard may be temporarily locked by other processes.
#[cfg(target_os = "windows")]
pub fn clear_clipboard_all() -> Result<(), String> {
    const ATTEMPTS: usize = 10;
    const SLEEP_MS: u64 = 25;

    for attempt in 0..ATTEMPTS {
        unsafe {
            let hwnd = GetForegroundWindow();
            let opened: BOOL = OpenClipboard(hwnd);

            if opened == 0 {
                if attempt + 1 < ATTEMPTS {
                    std::thread::sleep(Duration::from_millis(SLEEP_MS));
                    continue;
                }
                let err = GetLastError();
                return Err(format!("OPENCLIPBOARD_FAILED ({})", err));
            }

            let emptied: BOOL = EmptyClipboard();
            CloseClipboard();

            if emptied == 0 {
                let err = GetLastError();
                return Err(format!("EMPTYCLIPBOARD_FAILED ({})", err));
            }

            return Ok(());
        }
    }

    Err("CLIPBOARD_BUSY".to_string())
}
