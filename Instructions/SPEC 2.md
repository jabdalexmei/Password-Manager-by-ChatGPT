# SPEC 2 — UI-VAULT-UX-CLEANUP-02

## Title

Vault UX cleanup: single source of primary actions, proper Trash mode UI, and visible error feedback

## Goal

Remove “demo-ish” clutter and make core flows obvious:

- One consistent place for “Add data card / Add folder”
    
- Trash mode behaves correctly (Restore/Purge instead of Edit/Delete/Favorite)
    
- Errors become visible via toasts (not only console)
    

## Scope

Frontend only:

- `src/features/Vault/Vault.tsx`
    
- `src/features/Vault/useVault.ts`
    
- `src/features/Vault/components/DataCards/DataCards.tsx`
    
- `src/features/Vault/components/Details/Details.tsx`
    
- `src/components/Toaster.tsx` (if not already used properly)
    

## Requirements

### 1) Single source of primary actions (sidebar only)

**File:** `src/features/Vault/Vault.tsx`

- Sidebar must always show **both** buttons:
    
    - “Add data card” (primary)
        
    - “Add folder” (secondary)
        
- These buttons must be visible even when the user selects “Deleted”.
    

**File:** `src/features/Vault/components/DataCards/DataCards.tsx`

- Remove the duplicate “Add data card” button from the DataCards header area.
    
- The DataCards header should contain only the title (“Data cards”) and optional future controls (sort/filter), but no primary actions.
    

### 2) Trash mode UI rules

**Definition:** Trash mode = the user selected the “Deleted” navigation item.

**File:** `src/features/Vault/useVault.ts`

- Ensure there is a stable boolean exposed: `isTrashMode`.
    
- Ensure data sources:
    
    - Active list for normal mode
        
    - Deleted list for trash mode (list_deleted_datacards)
        

**File:** `src/features/Vault/components/Details/Details.tsx`

When `isTrashMode === false`:

- Show actions: **Mark favorite**, **Edit**, **Delete**
    

When `isTrashMode === true`:

- Show actions: **Restore**, **Purge**
    
- Hide: Mark favorite, Edit, Delete
    

### 3) Remove per-item “action spam” in lists

**File:** `src/features/Vault/components/DataCards/DataCards.tsx`

- Ensure list items are click-to-select only.
    
- Do not render Delete/Restore/Purge buttons inside each list item row.
    

### 4) Visible error feedback with toasts

**File:** `src/features/Vault/useVault.ts`

- Any failed backend call must surface a toast (error) with a human-readable message.
    
- Remove reliance on `console.error` as the only feedback.
    
- Implement mapping from backend error codes to localized messages (if your i18n already has it; otherwise use a generic “Operation failed”).
    

**File:** `src/components/Toaster.tsx`

- Ensure the toasts are visible and styled using the existing `ui.css` toast styles.
    
- Ensure the dismiss button uses an i18n aria-label.
    

## Acceptance Criteria

- There is exactly one place to start creating: sidebar buttons.
    
- Switching to Deleted does not hide Add folder / Add data card.
    
- In Deleted mode, Details shows Restore/Purge only.
    
- Backend errors always show a toast.
