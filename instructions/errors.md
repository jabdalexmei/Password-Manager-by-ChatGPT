

# Technical Specification: Fix `rusqlite::Connection::deserialize` mutability error (E0596)

## Goal

Fix compilation error:
`error[E0596]: cannot borrow conn as mutable, as it is not declared as mutable`
at the call to `conn.deserialize(...)`.

## Scope

Backend only. Single-file change.

---

## Change

### File

`src-tauri/src/services/security_service.rs`

### Location

The function where you open a SQLite connection and then call:

```rust
conn.deserialize(DatabaseName::Main, owned, false)
```

### Required modification

Make the `conn` binding mutable.

#### Before

```rust
let conn = rusqlite::Connection::open_with_flags(&uri, flags)?;
conn.deserialize(DatabaseName::Main, owned, false)
```

#### After

```rust
let mut conn = rusqlite::Connection::open_with_flags(&uri, flags)?;
conn.deserialize(DatabaseName::Main, owned, false)
```

*(If your code uses `.map_err(...)` for project error type, keep that wrapping exactly as-is; only add `mut`.)*

