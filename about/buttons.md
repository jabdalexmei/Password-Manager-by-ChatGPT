Ок, давай разложим **все кнопки по типам** и покажем **где именно** в проекте они используются (по текущему архиву `Password-Manager-by-ChatGPT-codex-github-mention-implement-protected-vault-encryption-flows(1).zip`).

## 1) Какие “семейства” кнопок есть в проекте

### A) Большие обычные кнопки: `.btn`

**Стили лежат:** `src/styles/ui.css`
**Варианты:**

* `btn btn-primary` — основной CTA (главное действие)
* `btn btn-secondary` — нейтральное действие (Cancel / второстепенное)
* `btn btn-danger` — опасное/удаляющее
* `btn btn-ghost` — лёгкая/вторичная (часто “Back” или “Remove” в списке)
* `btn btn-secondary btn-attach` — спец-кейс “Attach” (внутри диалога)

### B) Маленькие иконки-кнопки: `.icon-button`

**Стили лежат:** `src/styles/screens/vault.css`
**Варианты:**

* `icon-button` — обычная иконка
* `icon-button-primary` — акцентная иконка (например regenerate)
* `icon-button-danger` — опасная (delete attachment)

### C) Кнопка-ссылка: `.link-button`

**Стили лежат:** `src/styles/ui.css`
Используется как “создать” ссылкой, без вида кнопки.

---

## 2) Полная карта: где какие кнопки стоят (путь → действие → классы)

### Startup (выбор профиля)

**Файл:** `src/features/Startup/Startup.tsx`

* **Delete profile** → `btn btn-danger`
* **Open profile** → `btn btn-primary`
* **Create** (внизу как ссылка) → `link-button`

---

### LogIn (ввод пароля профиля)

**Файл:** `src/features/LogIn/LogIn.tsx`

* **Back** → `btn btn-ghost`
* **Submit / Login** → `btn btn-primary`

---

### ProfileCreate (создание профиля)

**Файл:** `src/features/ProfileCreate/ProfileCreate.tsx`

* **Back** → `btn btn-ghost`
* **Submit / Create** → `btn btn-primary`

---

### Vault (основной экран)

**Файл:** `src/features/Vault/Vault.tsx`

* **Add Data Card** → `btn btn-primary`
* **Add Folder** → `btn btn-secondary`

---

### Folders (модалка создания папки)

**Файл:** `src/features/Vault/components/Folders/Folders.tsx`

* **Cancel** → `btn btn-secondary`
* **Create** → `btn btn-primary`

> Кнопки самих папок в списке — **не `.btn`**, а отдельный класс `vault-folder` (это отдельная UI сущность).

---

### DataCards (модалка Create/Edit карточки)

**Файл:** `src/features/Vault/components/DataCards/DataCards.tsx`

**Внутри поля пароля (иконки справа):**

* **Open generator** (иконка) → `icon-button`
* **Show/Hide password** (иконка) → `icon-button`

**Блок Attachments (в Create):**

* **Add attachment(s)** → `btn btn-secondary btn-attach`
* **Remove selected attachment from list** → `btn btn-ghost`

**Footer модалки:**

* **Cancel** → `btn btn-secondary`
* **Submit (Create/Save)** → `btn btn-primary`

---

### Details (Information панель + действия с карточкой)

**Файл:** `src/features/Vault/components/Details/Details.tsx`

**Верхние действия по карточке (не trash mode):**

* **Mark/Unmark favorite** → `btn btn-secondary`
* **Edit** → `btn btn-secondary`
* **Delete** → `btn btn-danger`

**В trash mode:**

* **Restore** → `btn btn-secondary`
* **Purge** → `btn btn-danger`

**Attachments panel (то, что ты рисовал: eye / download / delete):**

* **Add file** → `btn btn-secondary`
* Для каждого attachment:

  * **Preview (eye)** → `icon-button`
  * **Download (export)** → `icon-button`
  * **Delete (trash)** → `icon-button icon-button-danger`

---

### PasswordGeneratorModal

**Файл:** `src/features/Vault/components/modals/PasswordGeneratorModal.tsx`

* **Copy generated password** (иконка) → `icon-button`
* **Regenerate** (иконка) → `icon-button icon-button-primary`
* **Cancel/Close** → `btn btn-secondary`
* **Use** → `btn btn-primary`

---

### ConfirmDialog (универсальная подтверждалка)

**Файл:** `src/components/ConfirmDialog.tsx`

* **Cancel** → `btn btn-secondary`
* **Confirm** → `btn btn-danger`

---

### AttachmentPreviewModal

**Файл:** `src/features/Vault/components/modals/AttachmentPreviewModal.tsx`

* **Download** → `btn btn-secondary`
* **Close** → `btn btn-secondary`

---

## 3) Важное: что в CSS определено, но сейчас не используется

По этому архиву я **не нашёл** в TSX:

* `btn-outline`
* `btn-icon`
* legacy `.primary.primary-danger`

То есть они есть в `ui.css`, но UI сейчас на них не опирается.

---

## 4) Единственное место, где семантика может быть спорной

**Файл:** `src/features/Vault/components/modals/DeleteFolderModal.tsx`
Там кнопка **“delete folder only”** сейчас стоит как `btn btn-primary`, хотя действие **деструктивное** (логичнее `btn btn-danger`). Остальное по смыслу выглядит консистентно.

---

Если хочешь — следующим шагом могу составить **“таблицу стандартов”** (одно правило на весь проект): какие действия должны быть primary/secondary/danger/ghost, чтобы дизайн и смысл всегда совпадали. Это сильно уменьшает хаос, когда UI растёт.
