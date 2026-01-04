#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod commands;
mod data {
    pub mod fs {
        pub mod atomic_write;
    }
    pub mod storage_paths;
    pub mod workspaces {
        pub mod registry;
    }
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
    pub mod sqlite {
        pub mod diagnostics;
        pub mod init;
        pub mod migrations;
        pub mod pool;
        pub mod repo_impl;
    }
}
mod error;
mod services {
    pub mod attachments_service;
    pub mod backup_service;
    pub mod bank_cards_service;
    pub mod clipboard_service;
    pub mod datacards_service;
    pub mod folders_service;
    pub mod password_history_service;
    pub mod profiles_service;
    pub mod security_service;
    pub mod settings_service;
}
mod types;

use std::sync::Arc;

use app_state::AppState;
use commands::{
    attachments::*, backup::*, bank_cards::*, clipboard::*, datacards::*, folders::*,
    password_history::*, profiles::*, security::*, settings::*, workspace::*,
};
use data::storage_paths::StoragePaths;
use services::security_service;
use tauri::{Manager, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                let app_state = window.state::<Arc<AppState>>().inner().clone();
                let _ = security_service::auto_lock_cleanup(&app_state);
            }
            _ => {}
        })
        .setup(|app| {
            let storage_paths = match StoragePaths::new_unconfigured() {
                Ok(paths) => paths,
                Err(err) => {
                    let message = match err.code.as_str() {
                        "APP_DIR_UNAVAILABLE" => {
                            "Unable to determine application directory for Password Manager."
                        }
                        _ => "Unable to initialize Password Manager workspace storage.",
                    };
                    app.dialog()
                        .message(message)
                        .title("Password Manager")
                        .kind(MessageDialogKind::Error)
                        .blocking_show();
                    std::process::exit(1);
                }
            };

            app.manage(Arc::new(AppState::new(storage_paths)));
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
            health_check,
            list_attachments,
            add_attachment_from_path,
            remove_attachment,
            purge_attachment,
            get_attachment_bytes_base64,
            get_attachment_preview,
            save_attachment_to_path,
            backup_create,
            backup_restore,
            backup_inspect,
            backup_restore_workflow,
            backup_list,
            backup_create_if_due_auto,
            list_folders,
            create_folder,
            rename_folder,
            move_folder,
            delete_folder_only,
            delete_folder_and_cards,
            list_bank_cards_summary_command,
            list_deleted_bank_cards_summary_command,
            get_bank_card,
            create_bank_card,
            update_bank_card,
            set_bank_card_favorite,
            delete_bank_card,
            restore_bank_card,
            purge_bank_card,
            restore_all_deleted_bank_cards,
            purge_all_deleted_bank_cards,
            list_datacards,
            list_datacards_summary_command,
            get_datacard,
            create_datacard,
            update_datacard,
            set_datacard_favorite,
            move_datacard_to_folder,
            delete_datacard,
            list_deleted_datacards,
            list_deleted_datacards_summary_command,
            restore_datacard,
            purge_datacard,
            restore_all_deleted_datacards,
            purge_all_deleted_datacards,
            get_datacard_password_history,
            clear_datacard_password_history,
            get_settings,
            update_settings,
            workspace_list,
            workspace_select,
            workspace_create,
            workspace_create_default,
            workspace_remove,
            workspace_open_in_explorer,
            clipboard_clear_all
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
