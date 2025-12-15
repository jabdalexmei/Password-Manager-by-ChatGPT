PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  TEXT NULL,
  is_system  INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_name
ON folders(parent_id, name)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_parent
ON folders(parent_id);

CREATE TABLE IF NOT EXISTS datacards (
  id           TEXT PRIMARY KEY,
  folder_id    TEXT NULL,

  title        TEXT NOT NULL,
  url          TEXT NULL,
  email        TEXT NULL,
  username     TEXT NULL,
  mobile_phone TEXT NULL,
  note         TEXT NULL,

  tags_json           TEXT NOT NULL DEFAULT '[]',
  password_value      TEXT NULL,
  bank_card_json      TEXT NULL,
  custom_fields_json  TEXT NOT NULL DEFAULT '[]',

  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_datacards_folder
ON datacards(folder_id);

CREATE INDEX IF NOT EXISTS idx_datacards_deleted
ON datacards(deleted_at);
