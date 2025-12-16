error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:13:36
   |
13 | pub async fn list_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> {
   |                                    ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
13 | pub async fn list_datacards(state: State<'_, Arc<AppState>>) -> Result<Vec<DataCard>> {
   |                                          +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:21:46
   |
21 | pub async fn get_datacard(id: String, state: State<Arc<AppState>>) -> Result<DataCard> {
   |                                              ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
21 | pub async fn get_datacard(id: String, state: State<'_, Arc<AppState>>) -> Result<DataCard> {
   |                                                    +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:31:12
   |
31 |     state: State<Arc<AppState>>,
   |            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
31 |     state: State<'_, Arc<AppState>>,
   |                  +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:42:12
   |
42 |     state: State<Arc<AppState>>,
   |            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
42 |     state: State<'_, Arc<AppState>>,
   |                  +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:53:12
   |
53 |     state: State<Arc<AppState>>,
   |            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
53 |     state: State<'_, Arc<AppState>>,
   |                  +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:64:49
   |
64 | pub async fn delete_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                 ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
64 | pub async fn delete_datacard(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                       +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:72:44
   |
72 | pub async fn list_deleted_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> {
   |                                            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
72 | pub async fn list_deleted_datacards(state: State<'_, Arc<AppState>>) -> Result<Vec<DataCard>> {
   |                                                  +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:80:50
   |
80 | pub async fn restore_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                  ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
80 | pub async fn restore_datacard(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                        +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:88:48
   |
88 | pub async fn purge_datacard(id: String, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
88 | pub async fn purge_datacard(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                      +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\datacards.rs:97:12
   |
97 |     state: State<Arc<AppState>>,
   |            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
97 |     state: State<'_, Arc<AppState>>,
   |                  +++

error[E0726]: implicit elided lifetime not allowed here
   --> src\commands\datacards.rs:107:12
    |
107 |     state: State<Arc<AppState>>,
    |            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
    |
help: indicate the anonymous lifetime
    |
107 |     state: State<'_, Arc<AppState>>,
    |                  +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:11:34
   |
11 | pub async fn list_folders(state: State<Arc<AppState>>) -> Result<Vec<Folder>> {
   |                                  ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
11 | pub async fn list_folders(state: State<'_, Arc<AppState>>) -> Result<Vec<Folder>> {
   |                                        +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:21:12
   |
21 |     state: State<Arc<AppState>>,
   |            ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
21 |     state: State<'_, Arc<AppState>>,
   |                  +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:30:61
   |
30 | pub async fn rename_folder(input: RenameFolderInput, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                             ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
30 | pub async fn rename_folder(input: RenameFolderInput, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                                   +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:38:57
   |
38 | pub async fn move_folder(input: MoveFolderInput, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                         ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
38 | pub async fn move_folder(input: MoveFolderInput, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                               +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:46:47
   |
46 | pub async fn delete_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> {
   |                                               ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
46 | pub async fn delete_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                     +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:54:42
   |
54 | pub async fn list_deleted_folders(state: State<Arc<AppState>>) -> Result<Vec<Folder>> {
   |                                          ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
54 | pub async fn list_deleted_folders(state: State<'_, Arc<AppState>>) -> Result<Vec<Folder>> {
   |                                                +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:62:48
   |
62 | pub async fn restore_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
62 | pub async fn restore_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                      +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\folders.rs:70:46
   |
70 | pub async fn purge_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> {
   |                                              ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
70 | pub async fn purge_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                    +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\settings.rs:11:34
   |
11 | pub async fn get_settings(state: State<Arc<AppState>>) -> Result<UserSettings> {
   |                                  ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
11 | pub async fn get_settings(state: State<'_, Arc<AppState>>) -> Result<UserSettings> {
   |                                        +++

error[E0726]: implicit elided lifetime not allowed here
  --> src\commands\settings.rs:19:61
   |
19 | pub async fn update_settings(settings: UserSettings, state: State<Arc<AppState>>) -> Result<bool> {
   |                                                             ^^^^^^^^^^^^^^^^^^^^ expected lifetime parameter
   |
help: indicate the anonymous lifetime
   |
19 | pub async fn update_settings(settings: UserSettings, state: State<'_, Arc<AppState>>) -> Result<bool> {
   |                                                                   +++

error[E0277]: `Pragmas` doesn't implement `Debug`
   --> src\data\sqlite\pool.rs:16:75
    |
 16 | impl r2d2::CustomizeConnection<rusqlite::Connection, rusqlite::Error> for Pragmas {
    |                                                                           ^^^^^^^ the trait `Debug` is not implemented for `Pragmas`
    |
    = note: add `#[derive(Debug)]` to `Pragmas` or manually `impl Debug for Pragmas`
note: required by a bound in `CustomizeConnection`
   --> C:\Users\pc\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\r2d2-0.8.10\src\lib.rs:126:38
    |
126 | pub trait CustomizeConnection<C, E>: fmt::Debug + Send + Sync + 'static {
    |                                      ^^^^^^^^^^ required by this bound in `CustomizeConnection`
help: consider annotating `Pragmas` with `#[derive(Debug)]`
    |
 14 + #[derive(Debug)]
 15 | struct Pragmas;
    |

Some errors have detailed explanations: E0277, E0726.
For more information about an error, try `rustc --explain E0277`.
error: could not compile `password-manager` (bin "password-manager") due to 22 previous errors
