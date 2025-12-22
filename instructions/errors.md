

# Technical Specification: Fix frontend dialog import for Tauri v2 and enable dialog permissions

## Goal

Fix Vite error:
`Failed to resolve import "@tauri-apps/api/dialog" ... useDetails.tsx`

by migrating to Tauri v2 dialog plugin JS API and ensuring required plugin permissions are enabled.

## Scope

* Frontend: replace deprecated dialog import and add the missing npm dependency.
* Backend config: add capability file to allow dialog open (prevents runtime permission errors).

## References

* Tauri v2 migration guide: `@tauri-apps/api/dialog` removed; use `@tauri-apps/plugin-dialog`. ([Tauri][1])
* Dialog plugin JS API reference (`open`). ([Tauri][3])
* Capabilities system and dialog permission requirement (`dialog:allow-open`). ([GitHub][2])

---

## 1) Frontend: replace deprecated import path

### File

`src/features/Vault/components/Details/useDetails.tsx`

### Change

Replace:

```ts
import { open } from "@tauri-apps/api/dialog";
```

With:

```ts
import { open } from "@tauri-apps/plugin-dialog";
```

### Acceptance criteria

* Vite no longer fails with `Failed to resolve import "@tauri-apps/api/dialog"`.

---

## 2) Frontend: add missing npm dependency

### File

`package.json`

### Change

Add dependency:

```json
"@tauri-apps/plugin-dialog": "^2.0.0"
```

**Example (dependencies section)**

```json
"dependencies": {
  "@tauri-apps/api": "...",
  "@tauri-apps/plugin-dialog": "^2.0.0",
  "react": "...",
  "react-dom": "..."
}
```

### Required command

Run in project root:

```bash
npm install
```

(Commit updated `package-lock.json` after install.)

### Acceptance criteria

* `node_modules/@tauri-apps/plugin-dialog` exists.
* Vite dev server starts without the import-analysis error.

---

## 3) Backend security: allow dialog open via capabilities (Tauri v2)

### Problem prevented

Without capabilities, at runtime you can get:
`dialog.open not allowed. Permissions associated with this command: dialog:allow-open` ([GitHub][2])

### Create capability file

#### New file

`src-tauri/capabilities/default.json`

#### Content

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for main window (dialog open).",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open"
  ]
}
```

Notes:

* Capability files placed under `src-tauri/capabilities` are used by Tauri’s capability system. ([Tauri][4])

### Acceptance criteria

* Opening file picker from frontend does not fail with “dialog.open not allowed”.
* `npm run tauri dev` works end-to-end for attachment “Add file”.

---

## Non-blocking warnings (optional cleanup, not required for build)

The Rust warnings shown (`dead_code`, unused functions) do not block compilation and can be handled later.

