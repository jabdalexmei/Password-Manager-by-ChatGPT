use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub active_profile: Mutex<Option<String>>,
    pub logged_in: Mutex<bool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            active_profile: Mutex::new(None),
            logged_in: Mutex::new(false),
        }
    }
}
