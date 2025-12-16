# SPEC — BUILD-FIX-STATE-LIFETIME-AND-R2D2-DEBUG-01

## Goal

Fix Rust build errors introduced after switching Tauri commands to `async` and adding an `r2d2_sqlite` pool:

* **E0726**: “implicit elided lifetime not allowed here” for `State<Arc<AppState>>`
* **E0277**: `Pragmas` does not implement `Debug` for `CustomizeConnection`

This spec must result in a clean build on Windows.

---

## 1) Fix E0726: Add explicit lifetime to `tauri::State`

### Files

* `src-tauri/src/commands/datacards.rs`
* `src-tauri/src/commands/folders.rs`
* `src-tauri/src/commands/settings.rs`
* Any other file under `src-tauri/src/commands/*.rs` that uses `State<Arc<AppState>>`

### Required change

In every Tauri command signature that currently uses:

```rust
State<Arc<AppState>>
```

Replace with:

```rust
State<'_, Arc<AppState>>
```

### Examples (apply to all)

**Before**

```rust
pub async fn list_datacards(state: State<Arc<AppState>>) -> Result<Vec<DataCard>> { ... }
pub async fn get_datacard(id: String, state: State<Arc<AppState>>) -> Result<DataCard> { ... }
pub async fn delete_folder(id: String, state: State<Arc<AppState>>) -> Result<bool> { ... }
pub async fn get_settings(state: State<Arc<AppState>>) -> Result<UserSettings> { ... }
```

**After**

```rust
pub async fn list_datacards(state: State<'_, Arc<AppState>>) -> Result<Vec<DataCard>> { ... }
pub async fn get_datacard(id: String, state: State<'_, Arc<AppState>>) -> Result<DataCard> { ... }
pub async fn delete_folder(id: String, state: State<'_, Arc<AppState>>) -> Result<bool> { ... }
pub async fn get_settings(state: State<'_, Arc<AppState>>) -> Result<UserSettings> { ... }
```

### Notes

* No behavior change is intended; this is purely a type/lifetime annotation required by the compiler for this usage.

---

## 2) Fix E0277: Add `Debug` to `Pragmas` used in r2d2 customization

### File

* `src-tauri/src/data/sqlite/pool.rs`

### Required change

Locate the struct used for `CustomizeConnection`, e.g.:

```rust
struct Pragmas;
```

Update it to:

```rust
#[derive(Debug)]
struct Pragmas;
```

### Explanation (implementation constraint)

`r2d2::CustomizeConnection` requires the implementor to be `Debug + Send + Sync + 'static`. Adding `#[derive(Debug)]` satisfies the `Debug` bound.

---

## 3) Acceptance Criteria

1. `cargo build` succeeds with no E0726 and no E0277 errors.
2. The application compiles and launches normally after the change.
3. No functional changes to Vault logic are introduced—only build fixes.

---

## 4) Verification Commands (developer must run)

From `src-tauri/` directory:

```bash
cargo clean
cargo build
```

Optional sanity checks:

```bash
cargo tree -i rusqlite
cargo tree -i libsqlite3-sys
```

Expected:

* Only one version of `rusqlite`
* Only one version of `libsqlite3-sys`

---
