

## 1) `cipher.rs`: Key без generic + nonce по ссылке/значению

### Файл: `src-tauri/src/data/crypto/cipher.rs`

#### A) Исправь создание cipher/key (убери `Key::<XChaCha20Poly1305>`)

**Было (как у тебя по ошибке):**

```rust
let key = Key::<XChaCha20Poly1305>::from_slice(key);
let cipher = XChaCha20Poly1305::new(key);
```

**Стало (корректно для chacha20poly1305 0.10.x):**

```rust
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};

let cipher = XChaCha20Poly1305::new_from_slice(key)
    .map_err(|_| anyhow::anyhow!("INVALID_KEY_LEN"))?;
```

> `new_from_slice()` избавляет от проблемы с `Key`-type-alias (у него реально **нет** generic параметров в 0.10.x).

#### B) Исправь split/pack nonce: `from_slice()` возвращает **ссылку**, а тебе нужно **значение**

У тебя ошибка:

* expected `GenericArray...`, found `&GenericArray...`

Значит где-то примерно так:

```rust
let nonce = XNonce::from_slice(&buf[start..end]);
Ok((nonce, ciphertext)) // nonce = &XNonce
```

**Исправление:**

```rust
let nonce = XNonce::from_slice(&buf[start..end]).clone();
Ok((nonce, ciphertext))
```

(Если `clone()` вдруг не подходит — можно `let nonce = *XNonce::from_slice(...);` но `clone()` надёжнее.)

#### C) `decrypt()` ждёт `&nonce`, а ты передаёшь nonce по значению

Ошибка:

* expected `&GenericArray...`, found `GenericArray...`

**Было:**

```rust
cipher.decrypt(
    nonce,
    Payload { msg: &ciphertext, aad },
)
```

**Стало:**

```rust
cipher.decrypt(
    &nonce,
    Payload { msg: &ciphertext, aad },
)
```

То же самое правило для `encrypt()` — обычно туда тоже передают `&nonce`.

---

## 2) `rusqlite`: `serialize/deserialize` больше не принимает `"main"` строкой

### Файл: `src-tauri/src/data/sqlite/init.rs`

Ошибка:

* `.serialize("main")` ожидает `DatabaseName`

**Было:**

```rust
.serialize("main")
```

**Стало:**

```rust
use rusqlite::DatabaseName;

.serialize(DatabaseName::Main)
```

---

## 3) `r2d2_sqlite`: нет `new_with_flags`, нужно `file(...).with_flags(...)`

### Файл: `src-tauri/src/data/sqlite/pool.rs`

Ошибка:

* `SqliteConnectionManager::new_with_flags` не существует

**Было:**

```rust
let manager = SqliteConnectionManager::new_with_flags(uri, flags);
```

**Стало:**

```rust
let manager = SqliteConnectionManager::file(uri).with_flags(flags);
```

Да, даже если `uri` у тебя вида `file:...?...`, это ок **при условии**, что в `flags` включён `OpenFlags::SQLITE_OPEN_URI` (иначе SQLite не воспримет строку как URI).

---

## 4) `AppHandle.state()` не виден: не импортирован `tauri::Manager`

### Файл: `src-tauri/src/services/attachments_service.rs`

Ошибка:

* method `state` not found; “trait Manager is not in scope”

**Добавь в начало файла:**

```rust
use tauri::Manager;
```

(Либо используй `try_state`, но правильнее просто импортировать `Manager`.)

---

## 5) `rusqlite::deserialize`: теперь требует `DatabaseName`, `OwnedData`, `bool`

### Файл: `src-tauri/src/services/security_service.rs`

Ошибка:

* `deserialize("main", &decrypted)` → неправильные аргументы
* не хватает bool
* ждёт `OwnedData`, а не `&Vec<u8>`

**Было (как по ошибке):**

```rust
conn.deserialize("main", &decrypted)
```

**Стало:**

```rust
use rusqlite::{DatabaseName, OwnedData};

let owned: OwnedData = decrypted.into(); // decrypted: Vec<u8>
conn.deserialize(DatabaseName::Main, owned, false)?;
```

> Если `decrypted.into()` вдруг не скомпилится (редко, но бывает), замени строку на явный конструктор, который есть в твоей версии `rusqlite`:

```rust
let owned = OwnedData::new(decrypted);
```

(Выбираешь тот вариант, который компилируется — но **смысл один**: Vec<u8> → OwnedData.)

### Там же: serialize на lock

Ошибка:

* `.serialize("main")`

**Исправь аналогично:**

```rust
use rusqlite::DatabaseName;

.serialize(DatabaseName::Main)
```

---

## 6) Warning: unused variable `key` (не критично, но лучше убрать)

### Файл: `src-tauri/src/services/security_service.rs`

**Было:**

```rust
let key = state.vault_key.lock().unwrap();
```

**Стало (если реально не используешь):**

```rust
let _key = state.vault_key.lock().unwrap();
```

---

После этих правок сборка должна пройти дальше, и если вылезут новые ошибки — они уже будут “следующего слоя” (диалоги файлов, пути, права, etc.), а не API-несовместимость.

Дальше логично: раз ты сказал “совместимость не нужна со старыми профилями” — можно жёстко требовать наличие `kdf_salt.bin/key_check.bin` для protected и убрать `password_hash` (как мы обсуждали) — но это уже отдельный чёткий проход по моделям registry.
