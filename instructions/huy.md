

# PR1 — Fix invoke args everywhere (если где-то ещё остался camelCase)

### Что делать

1. **Поиск:**

* по фронту: `invoke(` и `datacardId` / `attachmentId` / `sourcePath` / `targetPath` / `backupPath` / `tempId`

2. **Править только ключи payload** (имена переменных не трогать).

### Где править

* `src/features/Vault/api/vaultApi.ts` (главный)
* `src/features/Vault/components/**` если где-то invoke идёт не через api

### Что должно быть

* `datacard_id`
* `attachment_id`
* `source_path`
* `target_path`
* `backup_path`
* `temp_id`
* `new_profile_name`

### Что НЕ делать

* не менять сигнатуры Rust команд
* не добавлять “обёртки” вокруг invoke

### Быстрая проверка

* открыть приложение, открыть карточку, открыть историю паролей, открыть вложения → не должно быть `Operation failed` “на ровном месте”.

---

# PR2 — Fix update data loss (mappers)

### Почему

Даже если сейчас “кажется работает”, эта проблема убивает доверие к программе.

### Что делать

1. Открыть файл:

* `src/features/Vault/types/mappers.ts`

2. Найти:

* `mapCreateCardToBackend()`
* `mapUpdateCardToBackend()`

3. **Сделать два разных маппера:**

* Create: можно оставлять дефолты
* Update: **НЕ отправляет** `bank_card` и `custom_fields` вообще

### Точное требование

`mapUpdateCardToBackend()` должен формировать объект **только из полей, которые редактирует текущий UI**:

* title
* type/section
* fields (username/email/url/notes/… то, что реально есть в форме)
* password (см. ниже)

**Запрещено**: `bank_card: null`, `custom_fields: []` в update.

### Важная деталь про password

Если UI не менял пароль, update не должен его очищать.
Поэтому:

* если `input.password` отсутствует (undefined) — **не включать `password` в payload**
* если пользователь явно очистил поле (пустая строка) — отправить `password: ""` (или `null` если бек так ожидает, но тогда надо единый стандарт; сейчас проще: пустая строка)

### Быстрая проверка

* создать карточку, заполнить несколько полей, сохранить
* отредактировать только title → остальные поля не исчезают, пароль не пропадает.

---

# PR3 — Ensure Edit loads full card before saving

### Почему

Иначе update отправляет неполную модель и часть полей очищается.

### Что делать

1. Найти место, где открывается edit modal:

* `src/features/Vault/useVault.ts` и/или `src/features/Vault/components/...` (зависит от архитектуры)

2. Логика:

* при нажатии Edit:

  * если детальная карточка не загружена → вызвать `loadCardDetails(cardId)` → дождаться → открыть модалку

### Что не делать

* не “подставлять пустые поля” вместо отсутствующих
* не открывать форму на summary-объекте

### Быстрая проверка

* открыть список карточек
* быстро нажать Edit → поменять поле → Save
* пароль/заметки/прочие поля не должны очищаться.

---

# PR4 — Password history: DTO + UI access (если ещё что-то не сходится)

### Что проверить

1. Backend DTO содержит `datacard_id`

* `src-tauri/src/commands/password_history.rs`

  * `PasswordHistoryRowDto` должен иметь `datacard_id`

2. UI открывает history не только когда password field виден

* `src/features/Vault/components/Details/Details.tsx`

  * должна быть отдельная кнопка “History” (или icon) в actions

3. DB safety уже есть в `support(1)` (ты писал, что ensure_schema сделано) — проверить:

* `src-tauri/src/data/sqlite/migrations.rs`

  * `ensure_password_history_schema(conn)` вызывается всегда

### Быстрая проверка

* поменять пароль 2 раза → история показывает старые
* очистить пароль → старое значение есть в истории
* текущий пароль пустой → историю можно открыть.

---

# PR5 — Attachments: stabilize “Eye/Download/Delete”

### Что делать (front)

* `src/features/Vault/components/Details/…`

  * убедиться, что иконки соответствуют смыслу:

    * Eye = preview
    * Download/export = save to disk
    * Trash = delete with confirm

### Что делать (backend)

Проверить команды в:

* `src-tauri/src/commands/attachments.rs` (или где они объявлены)
  Должны быть:
* list for `datacard_id`
* add from path `source_path`
* preview bytes (base64 or bytes) for `attachment_id`
* save-to-path `target_path`
* delete `attachment_id`

### Что удалить / запретить

* любые вызовы внешнего opener для preview (у тебя требование: preview внутри приложения)

  * если где-то осталось `tauri-plugin-opener` для preview — выкинуть из preview-flow

### Быстрая проверка

* добавить файл → появился
* глаз → открывается модалка preview внутри программы
* export → сохраняет на диск
* delete → удаляет после подтверждения.

---

# PR6 — Backup: remove stubs + implement real encrypted zip (3 PRs)

Ты просил “что удалять и тд” — тут прям жёстко:

## PR6.1 Export only

### Удалить / заменить

* В `src-tauri/src/services/backup_service.rs`

  * удалить все `Err("BACKUP_UNSUPPORTED_VERSION")` в export-пути
  * реализовать `export_backup(...)`

### Добавить файлы

* (new) `src-tauri/src/services/backup_zip.rs` (helper to write/read zip)
* (optional) `src-tauri/src/services/backup_crypto.rs` (derive key + key_check + encrypt/decrypt)

### Cargo.toml

* добавить `zip`

### Проверка

* экспорт создаёт файл, импорт пока может быть заглушкой (это отдельный PR)

## PR6.2 Import decrypt to temp (cache)

### Добавить в AppState

* `backup_import_cache: Mutex<HashMap<String, BackupImportPayload>>`

### Реализовать

* `decrypt_backup_to_temp(...)` сохраняет plaintext payload в cache и возвращает `temp_id`

### Проверка

* неправильный пароль → ошибка
* правильный пароль → temp_id

## PR6.3 finalize_restore + finalize_import_as_new_profile

### Реализовать

* restore: только если профиль unlocked
* import-as-new: создаёт профиль, пароль=backup password

### Проверка

* restore реально меняет текущие данные
* import-as-new создаёт новый профиль и открывается.

---

# Что конкретно “удалять”, чтобы перестали делать фигню

1. **Запрещены заглушки**:

* строка `BACKUP_UNSUPPORTED_VERSION` в `backup_service.rs` после PR6.* должна исчезнуть полностью (grep check).

2. **Запрещён внешний preview**:

* любые `opener.open_*` для attachments preview (если где-то осталось) — удалить из preview flow.

3. **Запрещены update defaults**:

* `bank_card: null` и `custom_fields: []` не должны быть в update payload (grep check).

---

# Мини-скрипты проверки (для тебя)

После каждого PR прогоняй:

* `npm run dev` (Vite)
* `cargo tauri dev`
  И ручной чеклист по PR’у (2–5 минут).

---

