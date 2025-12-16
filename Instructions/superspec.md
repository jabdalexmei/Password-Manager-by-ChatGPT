

---

superspec — UI-I18N-01: Remove hardcoded UI text (100% through i18n)

## Goal

Ensure **all user-facing text** in the frontend is loaded via `useTranslation()` and i18n JSON files. No raw `"ID:"`, `"OK"`, `"Cancel"`, `"Delete"`, placeholder strings, helper texts, or dialog titles directly in JSX.

## Scope

Frontend only (`src/**`).  
Exception (allowed hardcoded): `index.html <title>` and Tauri window title/config (not part of React i18n).

## Required rule

Any string visible to the user must come from:

- `src/i18n/English/*.json`
    
- accessed via `useTranslation('<Module>')`
    

## Changes

### 1) Fix hardcoded “ID:” in Startup + LogIn

#### File: `src/features/Startup/Startup.tsx`

Replace:

```tsx
<p className="profile-id">
  ID: {profile.id}
</p>
```

With:

```tsx
<p className="profile-id">
  {t('label.profileId', { id: profile.id })}
</p>
```

#### File: `src/features/LogIn/LogIn.tsx`

Replace:

```tsx
<p className="profile-id">ID: {profileId}</p>
```

With:

```tsx
<p className="profile-id">{t('label.profileId', { id: profileId })}</p>
```

#### File: `src/i18n/English/Startup.json`

Add:

```json
"label.profileId": "ID: {{id}}"
```

#### File: `src/i18n/English/LogIn.json`

Add:

```json
"label.profileId": "ID: {{id}}"
```

---

### 2) Enforce “no hardcoded UI strings” rule across `src/**`

Developer must audit and replace any remaining raw UI strings.

**Audit method (mandatory):**

- Search in `src/**` for patterns:
    
    - `">[A-Za-z]` (text inside JSX)
        
    - `placeholder="..."`
        
    - `aria-label="..."`
        
    - `title="..."`
        
    - `confirmLabel="..."`
        
    - `cancelLabel="..."`
        
- Any matches must be replaced with i18n keys.
    

**Important:** keep i18n keys grouped by module:

- Vault screen → `Vault.json`
    
- Folders module → `Folders.json`
    
- DataCards module → `DataCards.json`
    
- Details module → `Details.json`
    
- Startup / LogIn / ProfileCreate etc → their own JSON files
    
- Generic actions/errors → `Common.json`
    

---

## Acceptance criteria

1. No `"ID:"` remains in JSX.
    
2. No visible UI string is hardcoded in React components.
    
3. All placeholders, labels, dialog titles, helper texts, and aria-labels use i18n keys.
    
4. The app still builds and all screens render correctly.
    

---

# SPEC 2 — UI-VAULT-POLISH-02: Fix Vault UI behavior + styling consistency

## Goal

Make Vault UI feel like a coherent app (not mixed “old CSS + random overrides”). Fix interaction issues and ensure all buttons/controls use one unified design system (`ui.css` tokens + `.btn` classes).

## Scope

Vault screen + shared dialog component styling used by Vault.

## Changes

### 1) Remove conflicting button styling in Vault sidebar

Right now `vault.css` overrides `.btn` inside `.vault-sidebar-actions`, which makes buttons look inconsistent.

#### File: `src/styles/screens/vault.css`

Delete the entire block:

```css
.vault-sidebar-actions .btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-weight: 600;
}

.vault-sidebar-actions .btn:hover {
  background: var(--surface-3);
  border-color: var(--border-strong);
}
```

**Result:** sidebar buttons will use canonical `.btn`, `.btn-primary`, `.btn-secondary` from `src/styles/ui.css`.

---

### 2) Ensure all interactive buttons use `.btn` system (no random class names)

#### File: `src/components/ConfirmDialog.tsx`

Update button classes from `secondary / primary` to canonical buttons.

Replace:

```tsx
<button className="secondary" onClick={onCancel}>
  {cancelLabel}
</button>
<button className="primary primary-danger" onClick={onConfirm}>
  {confirmLabel}
</button>
```

With:

```tsx
<button type="button" className="btn btn-secondary" onClick={onCancel}>
  {cancelLabel}
</button>
<button type="button" className="btn btn-danger" onClick={onConfirm}>
  {confirmLabel}
</button>
```

Also update the dialog title to use canonical class:  
Replace:

```tsx
<h3>{title}</h3>
```

With:

```tsx
<h3 className="dialog-title">{title}</h3>
```

And wrap description with a class for spacing:  
Replace:

```tsx
<p>{description}</p>
```

With:

```tsx
<p className="dialog-description">{description}</p>
```

#### File: `src/styles/ui.css`

Add style (if missing) near `.dialog-header` section:

```css
.dialog-description {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.4;
}
```

---

### 3) Improve search quality to match canon (search includes more fields)

Current search filters do NOT include `note` and `mobilePhone`.

#### File: `src/features/Vault/useVault.ts`

Inside `visibleCards` filtering, replace:

```ts
const fields = [card.title, card.username, card.email, card.url, ...(card.tags || [])];
```

With:

```ts
const fields = [
  card.title,
  card.username,
  card.email,
  card.url,
  card.mobilePhone,
  card.note,
  ...(card.tags || []),
];
```

---

### 4) Stop re-fetching trash forever when one trash list is empty

Current condition:

```ts
if (nav === 'deleted' && (deletedFolders.length === 0 || deletedCards.length === 0)) {
  await refreshTrash();
}
```

This causes repeated refresh if one list is legitimately empty.

#### File: `src/features/Vault/useVault.ts`

Add state:

```ts
const [trashLoaded, setTrashLoaded] = useState(false);
```

Update `refreshTrash`:

- after success, set `setTrashLoaded(true);`
    
- on lock/reset, set it back to `false`
    

Update `selectNav` condition to:

```ts
if (nav === 'deleted' && !trashLoaded) {
  await refreshTrash();
}
```

---

## Acceptance criteria

1. Vault buttons look consistent (sidebar/actions/dialogs use `.btn`).
    
2. Search matches by title/username/email/url/tags/**note/mobile phone**.
    
3. Switching to Deleted does not spam refresh when trash folders or trash cards are empty.
    
4. Confirm dialogs use the same visual system as Vault.
    

---

# SPEC 3 — UI-DIALOGS-03: Canonical dialogs for Data card + Folder (layout like the reference)

## Goal

Make **Create/Edit Data card** and **Create folder** dialogs look like the “good demo” style:

- centered modal
    
- clean spacing
    
- full-width inputs
    
- consistent footer actions
    
- proper close button
    
- keyboard friendly (Esc closes)
    

## Scope

Vault DataCards module + Folders dialog.

---

## Part A — Data card dialog (Create + Edit)

### A1) Dialog must be “single column stacked form” (NOT 2-column grid)

Right now it uses `.form-grid` (two columns). The reference modal is a vertical stack.

#### File: `src/styles/ui.css`

Add a new layout helper:

```css
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

Add textarea sizing:

```css
.textarea-notes {
  min-height: 110px;
  resize: vertical;
}
```

---

### A2) Update Data card modal markup to use `.form-stack`

#### File: `src/features/Vault/components/DataCards/DataCards.tsx`

In `DataCardDialog`, replace:

```tsx
<div className="form-grid">
```

With:

```tsx
<div className="form-stack">
```

Ensure every field becomes full width (one per row). No side-by-side layout.

---

### A3) Password row must match reference (input + buttons on the right)

You already have generate; the reference also typically has reveal/hide.

#### File: `src/features/Vault/components/DataCards/useDataCards.ts`

Add state:

- `showPassword: boolean`
    
- toggle action `togglePasswordVisibility()`
    

#### File: `src/features/Vault/components/DataCards/DataCards.tsx`

Change password input:

- `type={showPassword ? 'text' : 'password'}`
    

In the password field “button-row”, render:

- generate button
    
- reveal/hide button
    

Both buttons must use `btn btn-icon` and `aria-label` via i18n:

- `DataCards.json` add:
    

```json
"action.togglePasswordVisibility": "Toggle password visibility"
```

(Generate already exists via `action.generatePassword`.)

---

### A4) Footer actions must be consistent

Dialog footer must be right-aligned:

- Cancel → `btn btn-secondary`
    
- Create/Save → `btn btn-primary`
    

#### File: `src/features/Vault/components/DataCards/DataCards.tsx`

Ensure:

```tsx
<div className="dialog-actions">
  <button type="button" className="btn btn-secondary" onClick={onClose}>
    {tCommon('action.cancel')}
  </button>
  <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={!form.isValid}>
    {confirmLabel}
  </button>
</div>
```

If `isValid` is not implemented yet, implement Title validation (required) exactly:

- `title.trim().length > 0` else show inline error under Title.
    

---

### A5) Dialog behavior (must)

- `Esc` closes the dialog
    
- close “X” closes the dialog
    
- opening Create/Edit focuses Title input
    

Implementation requirement:

- add `useEffect` + `ref` on Title input, call `focus()` when dialog opens.
    

---

## Part B — Create folder dialog (small modal like reference)

### B1) Use same dialog system + footer buttons

#### File: `src/features/Vault/components/Folders/Folders.tsx`

The create folder dialog must:

- be centered modal
    
- title uses i18n (`Folders.dialog.newFolder.title`)
    
- input full width
    
- footer buttons: Cancel / OK (or Cancel / Create — pick ONE and keep consistent; recommended: **Cancel / Create**)
    

If switching to “Create”:

#### File: `src/i18n/English/Common.json`

Already has action keys; if not, add:

```json
"action.create": "Create"
```

Then use:

- Cancel → `tCommon('action.cancel')`
    
- Create → `tCommon('action.create')`
    

Also: enforce `type="button"` on non-submit buttons.

---

### B2) Validation (folder name required)

Already present key `Folders.validation.folderNameRequired`.

Requirement:

- on submit, if `name.trim()` empty → show error under input, do not close dialog.
    

---

## Acceptance criteria

1. Create/Edit Data card opens a centered stacked-form dialog (single column), no 2-column layout.
    
2. Password row has right-side icon buttons (generate + reveal/hide), all aria-labels via i18n.
    
3. Dialog footer buttons are consistent across dialogs (`btn` system).
    
4. Create folder dialog matches the same visual system and validates name.
    
5. Esc closes dialogs; Title auto-focuses when dialog opens.
    

---

If you hand these 3 specs to the developer, they’ll have enough precision to implement without inventing their own UI rules. The result should look much closer to the “good demo” style, but using your **current** codebase (no dependency on old files or old CSS architecture).