## Title

Details panel polish: icons, copy behavior, secret handling, multiline note rendering

## Goal

Make the Details panel feel “finished”:

- Replace emoji symbols with consistent icon buttons
    
- Copy buttons behave correctly (disabled/hidden when empty)
    
- Password is masked by default; reveal toggle works
    
- Notes render nicely (multiline)
    
- Clipboard clearing for secrets (security polish)
    

## Scope

Frontend only:

- `src/features/Vault/components/Details/Details.tsx`
    
- `src/features/Vault/components/Details/useDetails.ts` (or whichever hook owns details logic)
    
- `src/styles/screens/vault.css`
    
- `src/styles/ui.css`
    

## Requirements

### 1) Replace emoji glyphs with the same icon style used in Header

**File:** `src/features/Vault/components/Details/Details.tsx`

- Replace “⧉” and “👁” with:
    
    - Inline SVG icons (copy/eye/eye-off) matching the visual style of Header icons.
        
- Use a single class for these icon buttons:
    
    - `className="icon-button"`
        

### 2) Copy behavior: hide/disable when empty

**File:** `Details.tsx`

- For each field (URL/Username/Email/Mobile/Password/Note):
    
    - If the value is empty or equals the UI placeholder “—”, do not show the copy icon (preferred) OR render it disabled.
        
- On copy success: show a success toast (“Copied”).
    
- On copy fail: show an error toast.
    

### 3) Password masking and reveal toggle

**File:** `Details.tsx` + hook

- Default: password is masked.
    
- Reveal toggle shows real password only when toggled on.
    
- Masked view should not reveal length; use a fixed bullet string like `••••••••••••`.
    

### 4) Clipboard auto-clear for secrets

**File:** `useDetails.ts` (or equivalent hook)

Implement:

- `copyToClipboard(text: string, opts: { isSecret: boolean })`
    

If `isSecret` is true:

- After copying, start a timer using `clipboard_clear_timeout_seconds` (from settings).
    
- When timer fires: write an empty string to clipboard.
    
- If the user copies another secret before the timer ends, reset the timer.
    

### 5) Notes multiline rendering

**File:** `src/styles/screens/vault.css`

- Ensure notes use `white-space: pre-wrap;`
    
- Use a dedicated class like `.detail-value-multiline` applied to Notes value container.
    

### 6) Align Details spacing/typography

**File:** `vault.css`

- Ensure label/value spacing is consistent.
    
- Ensure action buttons in Details header align and don’t cause layout jumps.
    

## Acceptance Criteria

- Details has no emoji buttons; it uses consistent icon buttons.
    
- Copy icons don’t appear for empty values.
    
- Password is masked by default; reveal works.
    
- Secret copy clears clipboard after the configured timeout.
    
- Notes render multiline cleanly.
