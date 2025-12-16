# SPEC 1 — UI-DESIGN-SYSTEM-UNIFY-01

## Title

Unify design tokens and stop Vault screen from bypassing the global UI system

## Goal

Make the Vault screen look like a coherent product by ensuring **one design system** drives colors, radii, inputs, buttons, dialogs, and spacing.

## Scope

Frontend only:

- `src/styles/themes/blueTheme.css`
    
- `src/styles/ui.css`
    
- `src/styles/screens/vault.css`
    

## Requirements

### 1) Introduce consistent radius tokens

**File:** `src/styles/themes/blueTheme.css`

1. Replace `--radius-sm: 999px;` with a normal radius:
    
    - `--radius-sm: 10px;`
        
2. Add a pill radius token:
    
    - `--radius-pill: 999px;`
        

### 2) Ensure all shared components use tokens (not hardcoded values)

**File:** `src/styles/ui.css`

- Update `.btn` styles (and any input/dialog styles) to use:
    
    - `border-radius: var(--radius-sm);`
        
- For elements intended to be pill-shaped (if any), explicitly use:
    
    - `border-radius: var(--radius-pill);`
        

### 3) Eliminate hardcoded colors/radii in Vault screen

**File:** `src/styles/screens/vault.css`

- Replace any hardcoded colors like `#...` / `rgba(...)` that represent theme colors with the appropriate tokens:
    
    - background surfaces → `var(--color-surface-1)` / `var(--color-surface-2)` / `var(--color-surface-3)`
        
    - borders → `var(--color-border)`
        
    - primary accent → `var(--color-primary)`
        
    - text → `var(--color-text)` and muted variants if present
        
- Replace all `border-radius: 12px;` or similar with:
    
    - `border-radius: var(--radius-sm);`
        

### 4) Ensure “secondary buttons” exist and match the system

**File:** `src/styles/ui.css`

If `.btn-secondary` is missing, add:

```css
.btn-secondary {
  background: var(--color-surface-2);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn-secondary:not(:disabled):hover {
  border-color: var(--color-primary);
}
```

## Acceptance Criteria

- Vault buttons, inputs, cards, and dialogs share the **same radius style** (no mix of “pill” and “rounded rectangle” unless intentional).
    
- Vault does not introduce its own color palette; it uses tokens.
    
- No regression on other screens (Login/Profile/Startup).
