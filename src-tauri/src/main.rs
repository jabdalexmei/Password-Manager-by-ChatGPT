#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod commands;
mod data {
    pub mod storage_paths;
    pub mod crypto {
        pub mod cipher;
        pub mod kdf;
        pub mod key_check;
    }
    pub mod profiles {
        pub mod paths;
        pub mod registry;
    }
    pub mod settings {
        pub mod config;
    }
}
mod error;
mod services {
    pub mod profiles_service;
    pub mod security_service;
}
mod types;

use std::sync::Arc;

use app_state::AppState;
use commands::{profiles::*, security::*};
use data::storage_paths::initialize_storage_paths;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Err(err) = initialize_storage_paths() {
                app.dialog()
                    .message("Password Manager", err.message())
                    .kind(MessageDialogKind::Error)
                    .blocking_show();
                std::process::exit(1);
            }

            app.manage(Arc::new(AppState::new()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            profiles_list,
            profile_create,
            profile_delete,
            get_active_profile,
            set_active_profile,
            login_vault,
            lock_vault,
            is_logged_in,
            auto_lock_cleanup,
            health_check
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
