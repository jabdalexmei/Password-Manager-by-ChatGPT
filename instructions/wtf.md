

# TS (EN) — Split into Parts (Incremental Delivery)

## Общие правила поставки (для исполнителя)

* Each part must be delivered as a PR/branch with commits.
* Do not add placeholders/stubs. If a part includes UI, the backend must work for that part.
* Provide evidence: screenshots + short console logs for the acceptance checks of that part.

---

## Part 1 — Stabilize invoke args + prevent data loss on update

### Goal

Stop “Operation failed” caused by wrong invoke payload keys and stop wiping `bank_card/custom_fields` on save.

### Changes

#### 1.1 Standardize invoke payload keys to snake_case

**Files (search all `invoke(`):**

* `src/features/Vault/api/vaultApi.ts`
* any other files calling `invoke` directly

**Requirement**
Frontend must send snake_case keys matching Rust command parameters:

* `datacardId` → `datacard_id`
* `attachmentId` → `attachment_id`
* `sourcePath` → `source_path`
* `targetPath` → `target_path`
* etc.

#### 1.2 Fix update mapper so it does NOT wipe unrelated fields

**File**

* `src/features/Vault/types/mappers.ts`

**Requirement**
`mapUpdateCardToBackend()` must not hardcode:

* `bank_card: null`
* `custom_fields: []`

**Implementation options (choose one)**

* Option A (recommended): for update payload, omit `bank_card` and `custom_fields` entirely if UI does not edit them.
* Option B: include existing values from loaded card details (requires Part 2 behavior).

### Acceptance checks

* Edit a card and change only “title/meta/username/email” → Save → values persist.
* Existing `bank_card/custom_fields` (if present) are unchanged after saving.
* No console “Operation failed” due to missing command args (verify by expanding error object).



Если хочешь, я могу **сразу начать с Part 1** и сделать его ещё более конкретным под твой код: перечислить точные команды/ключи, которые сейчас расходятся, и в каких строках `mappers.ts` идёт затирание.
