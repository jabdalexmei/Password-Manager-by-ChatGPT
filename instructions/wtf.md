

### Блок “Work Rules / Delivery”

* **You must implement the required code yourself.** This TS is a specification, not a patch to apply blindly.
* **Do not invent behavior** not described in the TS. If something is unclear, ask before implementing.
* **Deliver as a PR / branch** with commits; no “here is a zip with random changes”.
* **Every change must be traceable**: commit message references the TS section (e.g., `TS-1.3 Password History invoke args`).
* **No partial implementations**: do not add UI without backend or vice versa.

### Блок “Definition of Done”

* `pnpm dev` / `npm run dev` passes
* `cargo tauri dev` passes
* Manual QA checklist from TS completed (attach screenshots/logs)
* No console errors during the tested flows
* All commands use snake_case args (grep check)


**Implementation requirement (must read):**
You are responsible for writing the code changes described below. Do not submit placeholders, stubs, or partial UI-only work. Deliver a PR with working backend + frontend, and include evidence that the QA checklist passes (screenshots + logs). If any point is unclear, stop and ask before implementing.






## Technical Specification (EN): Stabilize & Complete Password History + Attachments + Backup (Full Working State)

### Objective

Bring the app to a fully working state for:

1. **Password History** (UI + backend + stable DB behavior)
2. **Attachments** (add/open/download/delete + correct invoke args + stable preview behavior)
3. **Backup** (Export/Import ZIP, password-protected, restore/import flows)

Additionally, fix critical data-loss issues in card update mappers and unify the JS↔Rust command argument naming.

### Constraints / Principles

* Dev build: avoid “migration clutter”. Prefer **idempotent schema init** and **CREATE TABLE IF NOT EXISTS** guards to prevent runtime failures on older DB files.
* No requirement for compatibility with old profiles, but app must not randomly fail if an existing vault is missing a new table.
* Use **npm lucide-react** only (no vendored lucide).

---

# 0) Global Fix: JS↔Rust invoke parameter naming standard

## Problem

Frontend uses camelCase keys (e.g., `datacardId`) while Rust commands expect snake_case (e.g., `datacard_id`). This causes runtime failures that surface as generic “Operation failed”.

## Requirement

Standardize command argument keys across the entire project:

* **Frontend must send snake_case** to match Rust command parameter names.

## Implementation

### Files (frontend API layer)

* `src/features/Vault/api/vaultApi.ts`
* Any other files directly calling `invoke(...)` (search: `invoke(`)

### Action

Update every `invoke('command', { ... })` payload to use snake_case keys expected by Rust commands:

* `datacardId` → `datacard_id`
* `attachmentId` → `attachment_id`
* `sourcePath` → `source_path`
* `targetPath` → `target_path`
* etc.

### Acceptance

* No command fails due to missing argument mapping.
* DevTools no longer shows “Object” errors without meaningful toast.

---

# 1) Password History: Backend + DB + UI fully working

## 1.1 DB schema safety (no hard migrations; idempotent creation)

### Problem

`datacard_password_history` may be missing for older profiles, causing `DB_QUERY_FAILED`.

### Requirement

At app startup (DB init), always ensure:

* `datacard_password_history` table exists
* its index exists

### Files

* `src-tauri/src/data/sqlite/schema.sql`
* `src-tauri/src/data/sqlite/init.rs` (or wherever schema.sql is executed)
* `src-tauri/src/data/sqlite/migrations.rs` (only if still used; otherwise can be bypassed in dev)

### Implementation

1. Ensure `schema.sql` includes:

```sql
CREATE TABLE IF NOT EXISTS datacard_password_history (
  id TEXT PRIMARY KEY NOT NULL,
  datacard_id TEXT NOT NULL,
  password_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(datacard_id) REFERENCES datacards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_datacard_password_history_datacard_id
  ON datacard_password_history(datacard_id);
```

2. Ensure `schema.sql` is executed on every startup OR ensure `init.rs` calls a function that executes these `CREATE IF NOT EXISTS` statements even when `user_version` is current.

### Acceptance

* Saving a card never fails because of missing password-history table.

## 1.2 History write logic (correct change detection)

### Requirement

When updating a datacard:

* Save history only if old password is non-empty AND old != new (after trim).
* Clearing password (new empty) MUST save the old password into history.

### File

* `src-tauri/src/data/sqlite/repo_impl.rs` (`update_datacard` / related)

### Acceptance

* Edit any non-password field does not create history if password unchanged.
* Editing password creates one history row with previous value.
* Clearing password creates one history row with previous value.

## 1.3 Commands (stable invocation keys)

### Files

* `src-tauri/src/commands/password_history.rs`
* `src/features/Vault/api/vaultApi.ts`

### Required commands

* `get_datacard_password_history(datacard_id)`
* `clear_datacard_password_history(datacard_id)`

Frontend invoke payload MUST be:

```ts
invoke('get_datacard_password_history', { datacard_id: id })
```

## 1.4 UI behavior: history accessible even if current password field hidden

### Problem

Details panel hides empty fields; if password is empty, the password row disappears, and history becomes inaccessible.

### Requirement

History UI must be accessible when:

* Current password is empty, but history exists.

### Implementation (minimal UX, matches legacy)

In `src/features/Vault/components/Details/Details.tsx`:

* Add a small “Password history” action line visible if `hasHistory === true` OR always show a “History” icon under a “Security”/“Actions” section for the card.
* Determine `hasHistory` by calling `get_datacard_password_history` lazily when opening dialog; if list is non-empty, allow opening.

Simpler acceptable solution:

* Always show a “History” icon-button next to the “Updated:” line or in card actions toolbar (not inside password row).

### Files

* `src/features/Vault/components/Details/Details.tsx`
* `src/features/Vault/components/modals/PasswordHistoryDialog.tsx`

### Acceptance

* If password is currently empty but there are history entries, user can still open the history dialog.

---

# 2) Attachments: Add/Open/Download/Delete fully working

## 2.1 Frontend: ensure correct imports for dialog (Tauri v2)

### Problem

Import errors like `@tauri-apps/api/dialog` vs plugin mismatch.

### Requirement

Use **Tauri v2 dialog plugin**:

* `@tauri-apps/plugin-dialog`
* consistent imports everywhere

### Files

* `package.json`
* `src/features/Vault/components/Details/useDetails.tsx` (and any attachment-related UI)
* Search for: `@tauri-apps/api/dialog`

### Implementation

* Replace imports with:

```ts
import { open, save } from "@tauri-apps/plugin-dialog";
```

* Ensure dependency is installed with correct integrity (package-lock already fixed per user).

## 2.2 Backend: opener usage + capability permissions

### Problem

`tauri-plugin-opener` requires capability permissions; build error shows `Permission opener:default not found`.

### Requirement

* Ensure `opener` capability is correctly declared (or avoid opener and use internal preview).

### Files

* `src-tauri/capabilities/*` (capability JSONs)
* `src-tauri/tauri.conf.json`
* `src-tauri/src/services/attachments_service.rs`

### Decision

For security requirement: “preview must happen inside the program to not lose encryption”.
Therefore:

* Do NOT use external opener for preview.
* Implement **internal preview viewer** (webview modal/window) and serve decrypted bytes to it.

### Implementation

1. Replace “open_attachment” external opener usage with:

   * `get_attachment_preview_bytes(attachment_id)` command returning bytes/base64 + mime + name
2. Frontend opens a modal viewer and renders:

   * images via `<img src="data:mime;base64,...">`
   * pdf via `<iframe src="data:application/pdf;base64,...">` (if acceptable)
   * for unknown types: show “Download” only

### Commands

Add:

* `get_attachment_preview(attachment_id) -> { file_name, mime, bytes_b64 }`
* `download_attachment(attachment_id, target_path)` for saving to disk
* `delete_attachment(attachment_id)` with confirmation already on UI

### Files

Backend:

* `src-tauri/src/commands/attachments.rs` (or add)
* `src-tauri/src/services/attachments_service.rs`
  Frontend:
* `src/features/Vault/components/Details/useDetails.tsx`
* `src/features/Vault/components/modals/AttachmentPreviewDialog.tsx` (new)

### Acceptance

* Eye icon previews inside app for supported types without external apps.
* Export icon saves to user-selected path.
* Trash icon deletes after confirm.
* All operations use snake_case invoke args.

## 2.3 Fix current compile-time / runtime issues in attachments_service

### Problems observed earlier

* `open_path` Option generic inference errors
* conversion PathBuf→String
* reliance on opener plugin

### Requirement

Remove opener path entirely (see 2.2) to eliminate these issues.

---

# 3) Backup: fully implement encrypted ZIP export/import with two actions

## 3.1 Backend backup_service implementation (remove stubs)

### Files

* `src-tauri/src/services/backup_service.rs` (currently returns BACKUP_UNSUPPORTED_VERSION)
* `src-tauri/src/commands/backup.rs` (create if not present)
* `src-tauri/src/data/profiles/paths.rs` (for profile directories)
* `src-tauri/src/services/settings_service.rs` (store last/default export dir)

### Requirements

Backup file is a single `.zip` file, encrypted (AEAD XChaCha20-Poly1305) using:

* Argon2id (fixed params)
* key_check for password validation

### Export flow

Command:

* `export_backup(output_path, mode)`
  Where mode:
* `use_profile_password: boolean`
* `custom_password: Option<String>`

Rules:

* If use_profile_password: requires profile unlocked (vault session).
* If custom_password: can also require unlocked session to access vault files.
* Create ZIP payload containing:

  * `manifest.json`
  * `vault/vault.db` (as stored)
  * `vault/attachments/**` (as stored)
* Encrypt payload and write to `output_path`.

### Import flow

Commands:

1. `decrypt_backup_to_temp(backup_path, password) -> temp_import_id`
2. `finalize_restore(temp_import_id)` (requires unlocked session; overwrite current profile data)
3. `finalize_import_as_new_profile(temp_import_id, new_profile_name, password) -> new_profile_id`

Rules:

* Restore button in UI disabled unless profile is unlocked.
* Import-as-new creates a new profile with password = backup password.

### Atomicity

* Use temp directories and rename swaps (db + attachments).

### Acceptance

* Backup created on machine A imports on machine B without profile_id dependency.
* Restore overwrites current profile exactly (db + attachments).
* Import-as-new creates a new profile and can be unlocked with backup password.

---

# 4) Critical data integrity fixes (must-do)

## 4.1 Prevent data loss in mapUpdateCardToBackend

### Problem

Mapper always sends `bank_card: null` and `custom_fields: []`, wiping data.

### Files

* `src/features/Vault/types/mappers.ts`

### Requirement

Update mapping so that:

* update payload includes only fields actually supported by backend and present in UI state
* `custom_fields` and `bank_card` must be preserved:

  * Either include them from current card state, OR omit them entirely if not edited.

### Acceptance

* Editing username/email does not wipe other fields.

## 4.2 Ensure edit form is populated from full card details, not summary

### Problem

Using summary objects may omit password/note/mobile etc. Saving then clears them.

### Files

* `src/features/Vault/components/DataCards/useDataCards.ts`
* `src/features/Vault/useVault.ts`

### Requirement

Before opening edit modal:

* ensure full card details are loaded (`get_datacard(id)`), then populate form.
* Alternatively disable edit until full data is present.

### Acceptance

* Editing any field does not accidentally clear password/note/mobile.

---

# 5) Deliverables

1. Working Password History UI and backend with stable DB behavior.
2. Working Attachments panel:

   * add attachment
   * preview inside app (eye)
   * download (export icon)
   * delete with confirm (trash)
3. Working Backup:

   * Export to encrypted `.zip` with optional custom password
   * Import requiring password
   * User chooses Restore vs Import-as-new (two buttons)
4. Fixed mapper/data-loss issues.
5. All invoke argument keys standardized to snake_case.

---

# 6) QA checklist (minimum)

* Create profile, add card with password, change password, open history, clear history.
* Clear password, verify old value appears in history and history accessible.
* Add attachment, preview inside app, download to disk, delete.
* Export backup with profile password, import as new profile, open with same password.
* Export backup with custom password, restore into unlocked profile.
* Edit card fields, confirm bank/custom not wiped and password unchanged unless edited.
