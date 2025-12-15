

# ТЗ FIX-04 — Сборка не проходит: неверные имена Tauri-команд и borrow-checker в datacards_service

## 0) Цель

Устранить ошибки сборки Rust/Tauri:

1. `cannot find macro __cmd__get_settings_command / __cmd__update_settings_command`
2. `E0505 cannot move out of input because it is borrowed` в `datacards_service.rs`

Результат: `cargo build` в `src-tauri` проходит без ошибок.

---

## 1) Исправить регистрацию settings-команд в `src-tauri/src/main.rs`

### Проблема

В `tauri::generate_handler![...]` используются имена `get_settings_command` и `update_settings_command`, но в `src-tauri/src/commands/settings.rs` команды объявлены как `#[tauri::command] pub fn get_settings` и `pub fn update_settings`. Tauri генерирует макросы `__cmd__get_settings` и `__cmd__update_settings`, поэтому сборка падает.

### Изменение

Файл: `src-tauri/src/main.rs`

В списке `tauri::generate_handler![ ... ]`:

* заменить `get_settings_command` на `get_settings`
* заменить `update_settings_command` на `update_settings`

**Важно:** команда должна регистрироваться по имени функции с атрибутом `#[tauri::command]`.

### Ожидаемый эффект

Ошибки `cannot find macro __cmd__get_settings_command` и `__cmd__update_settings_command` исчезают. Warning `unused import settings::*` должен исчезнуть, если `settings::*` действительно используется после замены.

---

## 2) Исправить E0505 в `src-tauri/src/services/datacards_service.rs`

### Проблема

В `create_datacard` и `update_datacard` происходит:

* borrow: `let title = input.title.trim();`
* затем move: `let mut sanitized = input;`
* borrow используется после move (`sanitized.title = title.to_string()`), что запрещено.

### Изменение

Файл: `src-tauri/src/services/datacards_service.rs`

#### 2.1 `create_datacard`

Заменить текущую логику проверки title на безопасную:

* сначала сделать `let mut sanitized = input;`
* затем `sanitized.title = sanitized.title.trim().to_string();`
* затем проверить `if sanitized.title.is_empty() { return Err(DATACARD_TITLE_REQUIRED) }`

То есть **нельзя** держать `&str`-borrow от `input.title` до момента `sanitized = input`.

#### 2.2 `update_datacard`

Аналогично:

* `let mut sanitized = input;`
* `sanitized.title = sanitized.title.trim().to_string();`
* проверка на пустоту после trim

### Ожидаемый эффект

Ошибки компиляции:

* `error[E0505]: cannot move out of input because it is borrowed`
  исчезают.

---

## 3) Критерий приёмки

* `cd src-tauri && cargo build` проходит без ошибок.
* В `main.rs` зарегистрированы команды `get_settings` и `update_settings` (не `*_command`).
* В `datacards_service.rs` нет borrow от `input.title` до перемещения `input` в `sanitized`.

---
