use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::data::profiles::paths::vault_db_path;
use crate::error::{ErrorCodeString, Result};
use crate::types::{DataCard, Folder};

fn open_connection(profile_id: &str) -> Result<Connection> {
    Connection::open(vault_db_path(profile_id)).map_err(|_| ErrorCodeString::new("DB_OPEN_FAILED"))
}

fn parse_datetime(value: String) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(&value)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| ErrorCodeString::new("DB_PARSE_TIME"))
}

fn map_folder(row: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get("id")?,
        name: row.get("name")?,
        parent_id: row.get("parent_id")?,
        created_at: parse_datetime(row.get::<_, String>("created_at")?).unwrap(),
        updated_at: parse_datetime(row.get::<_, String>("updated_at")?).unwrap(),
        deleted_at: match row.get::<_, Option<String>>("deleted_at")? {
            Some(v) => Some(parse_datetime(v).unwrap()),
            None => None,
        },
    })
}

fn map_datacard(row: &rusqlite::Row) -> rusqlite::Result<DataCard> {
    Ok(DataCard {
        id: row.get("id")?,
        title: row.get("title")?,
        username: row.get("username")?,
        password: row.get("password")?,
        url: row.get("url")?,
        notes: row.get("notes")?,
        folder_id: row.get("folder_id")?,
        created_at: parse_datetime(row.get::<_, String>("created_at")?).unwrap(),
        updated_at: parse_datetime(row.get::<_, String>("updated_at")?).unwrap(),
        deleted_at: match row.get::<_, Option<String>>("deleted_at")? {
            Some(v) => Some(parse_datetime(v).unwrap()),
            None => None,
        },
    })
}

pub fn list_folders(profile_id: &str, include_deleted: bool) -> Result<Vec<Folder>> {
    let conn = open_connection(profile_id)?;
    let mut stmt = if include_deleted {
        conn.prepare("SELECT * FROM folders")
    } else {
        conn.prepare("SELECT * FROM folders WHERE deleted_at IS NULL")
    }
    .map_err(|_| ErrorCodeString::new("DB_QUERY"))?;
    let folders = stmt
        .query_map([], map_folder)
        .map_err(|_| ErrorCodeString::new("DB_QUERY"))?
        .filter_map(Result::ok)
        .collect();
    Ok(folders)
}

pub fn folder_exists_with_name(profile_id: &str, parent_id: &Option<String>, name: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT 1 FROM folders WHERE parent_id IS ?1 AND name = ?2 AND deleted_at IS NULL")
        .map_err(|_| ErrorCodeString::new("DB_QUERY"))?;
    let exists: Option<i32> = stmt
        .query_row(params![parent_id, name], |row| row.get(0))
        .optional()
        .map_err(|_| ErrorCodeString::new("DB_QUERY"))?;
    Ok(exists.is_some())
}

pub fn create_folder(profile_id: &str, name: &str, parent_id: &Option<String>) -> Result<Folder> {
    if folder_exists_with_name(profile_id, parent_id, name)? {
        return Err(ErrorCodeString::new("FOLDER_NAME_EXISTS"));
    }
    let conn = open_connection(profile_id)?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
        params![id, name, parent_id, now, now],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    get_folder(profile_id, &id)
}

pub fn get_folder(profile_id: &str, id: &str) -> Result<Folder> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM folders WHERE id = ?1")
        .map_err(|_| ErrorCodeString::new("DB_QUERY"))?;
    stmt.query_row(params![id], map_folder)
        .map_err(|_| ErrorCodeString::new("FOLDER_NOT_FOUND"))
}

pub fn rename_folder(profile_id: &str, id: &str, name: &str) -> Result<bool> {
    let folder = get_folder(profile_id, id)?;
    if folder_exists_with_name(profile_id, &folder.parent_id, name)? {
        return Err(ErrorCodeString::new("FOLDER_NAME_EXISTS"));
    }
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE folders SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, Utc::now().to_rfc3339(), id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn move_folder(profile_id: &str, id: &str, parent_id: &Option<String>) -> Result<bool> {
    let folder = get_folder(profile_id, id)?;
    if folder_exists_with_name(profile_id, parent_id, &folder.name)? {
        return Err(ErrorCodeString::new("FOLDER_NAME_EXISTS"));
    }
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE folders SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![parent_id, Utc::now().to_rfc3339(), id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn soft_delete_folder(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE folders SET deleted_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn restore_folder(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE folders SET deleted_at = NULL WHERE id = ?1",
        params![id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn purge_folder(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute("DELETE FROM datacards WHERE folder_id = ?1", params![id])
        .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])
        .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn list_datacards(profile_id: &str, include_deleted: bool, order: &str) -> Result<Vec<DataCard>> {
    let conn = open_connection(profile_id)?;
    let mut stmt = if include_deleted {
        conn.prepare(&format!("SELECT * FROM datacards ORDER BY {order}"))
    } else {
        conn.prepare(&format!("SELECT * FROM datacards WHERE deleted_at IS NULL ORDER BY {order}"))
    }
    .map_err(|_| ErrorCodeString::new("DB_QUERY"))?;
    let cards = stmt
        .query_map([], map_datacard)
        .map_err(|_| ErrorCodeString::new("DB_QUERY"))?
        .filter_map(Result::ok)
        .collect();
    Ok(cards)
}

pub fn get_datacard(profile_id: &str, id: &str) -> Result<DataCard> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM datacards WHERE id = ?1")
        .map_err(|_| ErrorCodeString::new("DB_QUERY"))?;
    stmt.query_row(params![id], map_datacard)
        .map_err(|_| ErrorCodeString::new("DATACARD_NOT_FOUND"))
}

pub fn create_datacard(
    profile_id: &str,
    title: &str,
    username: &Option<String>,
    password: &Option<String>,
    url: &Option<String>,
    notes: &Option<String>,
    folder_id: &Option<String>,
) -> Result<DataCard> {
    let conn = open_connection(profile_id)?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO datacards (id, title, username, password, url, notes, folder_id, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)",
        params![id, title, username, password, url, notes, folder_id, now, now],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    get_datacard(profile_id, &id)
}

pub fn update_datacard(
    profile_id: &str,
    id: &str,
    title: &str,
    username: &Option<String>,
    password: &Option<String>,
    url: &Option<String>,
    notes: &Option<String>,
    folder_id: &Option<String>,
) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE datacards SET title = ?1, username = ?2, password = ?3, url = ?4, notes = ?5, folder_id = ?6, updated_at = ?7 WHERE id = ?8",
        params![
            title,
            username,
            password,
            url,
            notes,
            folder_id,
            Utc::now().to_rfc3339(),
            id
        ],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn move_datacard(profile_id: &str, id: &str, folder_id: &Option<String>) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE datacards SET folder_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![folder_id, Utc::now().to_rfc3339(), id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn soft_delete_datacard(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE datacards SET deleted_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn restore_datacard(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE datacards SET deleted_at = NULL WHERE id = ?1",
        params![id],
    )
    .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}

pub fn purge_datacard(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute("DELETE FROM datacards WHERE id = ?1", params![id])
        .map_err(|_| ErrorCodeString::new("DB_WRITE"))?;
    Ok(true)
}
