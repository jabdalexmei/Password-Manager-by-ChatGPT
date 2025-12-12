error[E0433]: failed to resolve: could not find `api` in `tauri`
  --> src\main.rs:35:16
   |
35 |         tauri::api::dialog::blocking::MessageDialogBuilder::new("Password Manager", err.message())
   |                ^^^ could not find `api` in `tauri`

error[E0433]: failed to resolve: could not find `api` in `tauri`
  --> src\main.rs:36:26
   |
36 |             .kind(tauri::api::dialog::MessageDialogKind::Error)
   |                          ^^^ could not find `api` in `tauri`

error[E0277]: expected a `FnOnce(std::io::Error)` closure, found `StoragePathsError`
  --> src\data\storage_paths.rs:22:57
   |
22 |         std::fs::create_dir_all(&profiles_root).map_err(StoragePathsError::CreateProfilesDir)?;
   |                                                 ------- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ expected an `FnOnce(std::io::Error)` closure, found `StoragePathsError`
   |                                                 |
   |                                                 required by a bound introduced by this call
   |
help: the trait `FnOnce(std::io::Error)` is not implemented for `StoragePathsError`
  --> src\data\storage_paths.rs:45:1
   |
45 | pub enum StoragePathsError {
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^
note: required by a bound in `std::result::Result::<T, E>::map_err`
  --> /rustc/ed61e7d7e242494fb7057f2657300d9e77bb4fcb\library\core\src\result.rs:955:5

error[E0658]: use of unstable library feature `once_cell_try`
  --> src\data\storage_paths.rs:66:11
   |
66 |     PATHS.get_or_try_init(StoragePaths::initialize)
   |           ^^^^^^^^^^^^^^^
   |
   = note: see issue #109737 <https://github.com/rust-lang/rust/issues/109737> for more information

Some errors have detailed explanations: E0277, E0433, E0658.
For more information about an error, try `rustc --explain E0277`.
error: could not compile `password-manager` (bin "password-manager") due to 4 previous errors
