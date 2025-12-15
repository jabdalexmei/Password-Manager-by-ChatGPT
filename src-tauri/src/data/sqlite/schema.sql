CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS datacards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    username TEXT NULL,
    password TEXT NULL,
    url TEXT NULL,
    notes TEXT NULL,
    folder_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL,
    FOREIGN KEY(folder_id) REFERENCES folders(id)
);
