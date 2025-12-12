error[E0433]: failed to resolve: could not find `dialog` in `tauri`
  --> src\main.rs:35:16
   |
35 |         tauri::dialog::blocking::MessageDialogBuilder::new("Password Manager", err.message())
   |                ^^^^^^ could not find `dialog` in `tauri`

error[E0433]: failed to resolve: could not find `dialog` in `tauri`
  --> src\main.rs:36:26
   |
36 |             .kind(tauri::dialog::MessageDialogKind::Error)
   |                          ^^^^^^ could not find `dialog` in `tauri`

For more information about this error, try `rustc --explain E0433`.
error: could not compile `password-manager` (bin "password-manager") due to 2 previous errors
