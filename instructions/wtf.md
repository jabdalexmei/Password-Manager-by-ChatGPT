TS (EN) — Split into Parts (Incremental Delivery)
Общие правила поставки (для исполнителя)

Each part must be delivered as a PR/branch with commits.

Do not add placeholders/stubs. If a part includes UI, the backend must work for that part.

Provide evidence: screenshots + short console logs for the acceptance checks of that part.

## Part 2 — Ensure Edit uses full card details (no summary-save bugs)

### Goal

Prevent accidental clearing of password/note/mobile/etc when editing.

### Changes

#### 2.1 Load full card before opening Edit modal

**Files**

* `src/features/Vault/useVault.ts`
* `src/features/Vault/components/DataCards/useDataCards.ts`

**Requirement**
When user clicks “Edit”:

* if full details for selected card are not loaded yet (`cardDetailsById[id]` missing),

  * fetch details first (existing `get_datacard` / `loadCard`)
  * only then open edit dialog with full model

Alternative: disable Edit until details loaded (acceptable but worse UX).

### Acceptance checks

* Select a card, immediately click Edit, change a random field, Save.
* Verify `password` is NOT cleared if user did not touch it.
* Verify notes/phones/urls are not cleared.

---

## Part 3 — Password History: end-to-end working + accessible even when password empty

### Goal

Password history works reliably and can be opened even if current password is empty (since you hide empty fields).

### Changes

#### 3.1 DB safety: always ensure history table exists (no migration dependency)

**Files**

* `src-tauri/src/data/sqlite/schema.sql`
* `src-tauri/src/data/sqlite/init.rs` (or wherever schema is applied)

**Requirement**
Execute `CREATE TABLE IF NOT EXISTS datacard_password_history ...` and index on every init/startup.

#### 3.2 Commands wiring + invoke keys

**Backend**

* `src-tauri/src/commands/password_history.rs`
  **Frontend**
* `src/features/Vault/api/vaultApi.ts`

Ensure invoke uses `{ datacard_id }`.

#### 3.3 UI: make history accessible even if password field hidden

**Files**

* `src/features/Vault/components/Details/Details.tsx`
* `src/features/Vault/components/modals/PasswordHistoryDialog.tsx`

**Requirement**
History entry point must not be inside the password row only.
Add a “Password history” icon/button in a stable place (e.g., Details “Actions” row) that opens dialog for the card.

### Acceptance checks

* Change password twice → History shows previous passwords with timestamps.
* Clear password → old password is written to history.
* With current password empty, history dialog is still accessible and shows entries.
* Clear history works.


