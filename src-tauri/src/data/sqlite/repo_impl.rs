use chrono::Utc;
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;
use rusqlite::types::Type;
use uuid::Uuid;

use super::pool;
use crate::error::{ErrorCodeString, Result};
use crate::types::{
    BankCard, CreateDataCardInput, DataCard, DataCardSummary, Folder, UpdateDataCardInput,
};

fn open_connection(profile_id: &str) -> Result<PooledConnection<SqliteConnectionManager>> {
    pool::get_conn(profile_id)
}

fn deserialize_json<T: serde::de::DeserializeOwned>(value: String) -> rusqlite::Result<T> {
    serde_json::from_str(&value)
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err)))
}

fn serialize_json<T: serde::Serialize>(value: &T) -> Result<String> {
    serde_json::to_string(value).map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))
}

fn map_folder(row: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get("id")?,
        name: row.get("name")?,
        parent_id: row.get("parent_id")?,
        is_system: row.get::<_, i64>("is_system")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

fn map_datacard(row: &rusqlite::Row) -> rusqlite::Result<DataCard> {
    Ok(DataCard {
        id: row.get("id")?,
        folder_id: row.get("folder_id")?,
        title: row.get("title")?,
        url: row.get("url")?,
        email: row.get("email")?,
        username: row.get("username")?,
        mobile_phone: row.get("mobile_phone")?,
        note: row.get("note")?,
        tags: deserialize_json(row.get::<_, String>("tags_json")?)?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
        password: row.get("password_value")?,
        bank_card: match row.get::<_, Option<String>>("bank_card_json")? {
            Some(value) => Some(deserialize_json::<BankCard>(value)?),
            None => None,
        },
        custom_fields: deserialize_json(row.get::<_, String>("custom_fields_json")?)?,
    })
}

fn map_datacard_summary(row: &rusqlite::Row) -> rusqlite::Result<DataCardSummary> {
    let tags: Vec<String> = deserialize_json(row.get::<_, String>("tags_json")?)?;
    let is_favorite = tags.iter().any(|tag| tag == "favorite");

    Ok(DataCardSummary {
        id: row.get("id")?,
        folder_id: row.get("folder_id")?,
        title: row.get("title")?,
        url: row.get("url")?,
        email: row.get("email")?,
        username: row.get("username")?,
        tags,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
        is_favorite,
    })
}

fn order_clause(sort_field: &str, sort_dir: &str) -> Option<&'static str> {
    match (sort_field, sort_dir) {
        ("updated_at", "DESC") => Some("ORDER BY updated_at DESC, title ASC"),
        ("updated_at", "ASC") => Some("ORDER BY updated_at ASC, title ASC"),
        ("created_at", "DESC") => Some("ORDER BY created_at DESC, title ASC"),
        ("created_at", "ASC") => Some("ORDER BY created_at ASC, title ASC"),
        ("title", "ASC") => Some("ORDER BY title ASC, updated_at DESC"),
        ("title", "DESC") => Some("ORDER BY title DESC, updated_at DESC"),
        _ => None,
    }
}

fn map_constraint_error(err: rusqlite::Error) -> ErrorCodeString {
    if let rusqlite::Error::SqliteFailure(info, _) = &err {
        if info.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE {
            return ErrorCodeString::new("FOLDER_NAME_EXISTS");
        }
    }
    ErrorCodeString::new("DB_QUERY_FAILED")
}

pub fn list_folders(profile_id: &str) -> Result<Vec<Folder>> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM folders WHERE deleted_at IS NULL ORDER BY name ASC")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let folders = stmt
        .query_map([], map_folder)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    Ok(folders)
}

pub fn list_deleted_folders(profile_id: &str) -> Result<Vec<Folder>> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM folders WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let folders = stmt
        .query_map([], map_folder)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    Ok(folders)
}

pub fn get_folder(profile_id: &str, id: &str) -> Result<Folder> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM folders WHERE id = ?1")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    stmt.query_row(params![id], map_folder)
        .map_err(|_| ErrorCodeString::new("FOLDER_NOT_FOUND"))
}

pub fn create_folder(profile_id: &str, name: &str, parent_id: &Option<String>) -> Result<Folder> {
    let conn = open_connection(profile_id)?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, is_system, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, 0, ?4, ?5, NULL)",
        params![id, name, parent_id, now, now],
    )
    .map_err(map_constraint_error)?;

    get_folder(profile_id, &id)
}

pub fn rename_folder(profile_id: &str, id: &str, name: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let rows = conn
        .execute(
            "UPDATE folders SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, Utc::now().to_rfc3339(), id],
        )
        .map_err(map_constraint_error)?;
    if rows == 0 {
        return Err(ErrorCodeString::new("FOLDER_NOT_FOUND"));
    }
    Ok(true)
}

pub fn move_folder(profile_id: &str, id: &str, parent_id: &Option<String>) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let rows = conn
        .execute(
            "UPDATE folders SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![parent_id, Utc::now().to_rfc3339(), id],
        )
        .map_err(map_constraint_error)?;
    if rows == 0 {
        return Err(ErrorCodeString::new("FOLDER_NOT_FOUND"));
    }
    Ok(true)
}

pub fn soft_delete_folder(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let now = Utc::now().to_rfc3339();
    let rows = conn
        .execute(
            "UPDATE folders SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
            params![now.clone(), now, id],
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("FOLDER_NOT_FOUND"));
    }
    Ok(true)
}

pub fn restore_folder(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let rows = conn
        .execute(
            "UPDATE folders SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("FOLDER_NOT_FOUND"));
    }
    Ok(true)
}

pub fn purge_folder(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute("DELETE FROM datacards WHERE folder_id = ?1", params![id])
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    let rows = conn
        .execute("DELETE FROM folders WHERE id = ?1", params![id])
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("FOLDER_NOT_FOUND"));
    }
    Ok(true)
}

pub fn list_datacards(
    profile_id: &str,
    include_deleted: bool,
    sort_field: &str,
    sort_dir: &str,
) -> Result<Vec<DataCard>> {
    let conn = open_connection(profile_id)?;
    let clause = order_clause(sort_field, sort_dir)
        .ok_or_else(|| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    let base_query = if include_deleted {
        format!("SELECT * FROM datacards {clause}")
    } else {
        format!("SELECT * FROM datacards WHERE deleted_at IS NULL {clause}")
    };
    let mut stmt = conn
        .prepare(&base_query)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    let cards = stmt
        .query_map([], map_datacard)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    Ok(cards)
}

pub fn list_datacards_summary(
    profile_id: &str,
    sort_field: &str,
    sort_dir: &str,
) -> Result<Vec<DataCardSummary>> {
    let conn = open_connection(profile_id)?;
    let clause = order_clause(sort_field, sort_dir)
        .ok_or_else(|| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    let query = format!(
        "SELECT id, folder_id, title, url, email, username, tags_json, created_at, updated_at, deleted_at FROM datacards WHERE deleted_at IS NULL {clause}"
    );
    let mut stmt = conn
        .prepare(&query)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let cards = stmt
        .query_map([], map_datacard_summary)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    Ok(cards)
}

pub fn list_deleted_datacards(profile_id: &str) -> Result<Vec<DataCard>> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM datacards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let cards = stmt
        .query_map([], map_datacard)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    Ok(cards)
}

pub fn list_deleted_datacards_summary(profile_id: &str) -> Result<Vec<DataCardSummary>> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, folder_id, title, url, email, username, tags_json, created_at, updated_at, deleted_at FROM datacards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    let cards = stmt
        .query_map([], map_datacard_summary)
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    Ok(cards)
}

pub fn get_datacard(profile_id: &str, id: &str) -> Result<DataCard> {
    let conn = open_connection(profile_id)?;
    let mut stmt = conn
        .prepare("SELECT * FROM datacards WHERE id = ?1")
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    stmt.query_row(params![id], map_datacard)
        .map_err(|_| ErrorCodeString::new("DATACARD_NOT_FOUND"))
}

fn serialize_card_fields(input: &CreateDataCardInput) -> Result<(String, String, Option<String>)> {
    let tags_json = serialize_json(&input.tags)?;
    let custom_fields_json = serialize_json(&input.custom_fields)?;
    let bank_card_json = match &input.bank_card {
        Some(card) => Some(serialize_json(card)?),
        None => None,
    };
    Ok((tags_json, custom_fields_json, bank_card_json))
}

pub fn create_datacard(profile_id: &str, input: &CreateDataCardInput) -> Result<DataCard> {
    let conn = open_connection(profile_id)?;
    let (tags_json, custom_fields_json, bank_card_json) = serialize_card_fields(input)?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO datacards (id, folder_id, title, url, email, username, mobile_phone, note, tags_json, password_value, bank_card_json, custom_fields_json, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL)",
        params![
            id,
            input.folder_id,
            input.title,
            input.url,
            input.email,
            input.username,
            input.mobile_phone,
            input.note,
            tags_json,
            input.password,
            bank_card_json,
            custom_fields_json,
            now,
            now
        ],
    )
    .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;

    get_datacard(profile_id, &id)
}

pub fn update_datacard(profile_id: &str, input: &UpdateDataCardInput) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let tags_json = serialize_json(&input.tags)?;
    let custom_fields_json = serialize_json(&input.custom_fields)?;
    let bank_card_json = match &input.bank_card {
        Some(card) => Some(serialize_json(card)?),
        None => None,
    };
    let rows = conn
        .execute(
            "UPDATE datacards SET title = ?1, url = ?2, email = ?3, username = ?4, mobile_phone = ?5, note = ?6, tags_json = ?7, password_value = ?8, bank_card_json = ?9, custom_fields_json = ?10, folder_id = ?11, updated_at = ?12 WHERE id = ?13",
            params![
                input.title,
                input.url,
                input.email,
                input.username,
                input.mobile_phone,
                input.note,
                tags_json,
                input.password,
                bank_card_json,
                custom_fields_json,
                input.folder_id,
                Utc::now().to_rfc3339(),
                input.id
            ],
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("DATACARD_NOT_FOUND"));
    }
    Ok(true)
}

pub fn move_datacard(profile_id: &str, id: &str, folder_id: &Option<String>) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let rows = conn
        .execute(
            "UPDATE datacards SET folder_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![folder_id, Utc::now().to_rfc3339(), id],
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("DATACARD_NOT_FOUND"));
    }
    Ok(true)
}

pub fn soft_delete_datacard(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let now = Utc::now().to_rfc3339();
    let rows = conn
        .execute(
            "UPDATE datacards SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
            params![now.clone(), now, id],
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("DATACARD_NOT_FOUND"));
    }
    Ok(true)
}

pub fn restore_datacard(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let rows = conn
        .execute(
            "UPDATE datacards SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("DATACARD_NOT_FOUND"));
    }
    Ok(true)
}

pub fn purge_datacard(profile_id: &str, id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let rows = conn
        .execute("DELETE FROM datacards WHERE id = ?1", params![id])
        .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    if rows == 0 {
        return Err(ErrorCodeString::new("DATACARD_NOT_FOUND"));
    }
    Ok(true)
}

pub fn soft_delete_datacards_in_folder(profile_id: &str, folder_id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE datacards SET deleted_at = ?1, updated_at = ?2 WHERE folder_id = ?3",
        params![now.clone(), now, folder_id],
    )
    .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    Ok(true)
}

pub fn restore_datacards_in_folder(profile_id: &str, folder_id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "UPDATE datacards SET deleted_at = NULL, updated_at = ?1 WHERE folder_id = ?2",
        params![Utc::now().to_rfc3339(), folder_id],
    )
    .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    Ok(true)
}

pub fn purge_datacards_in_folder(profile_id: &str, folder_id: &str) -> Result<bool> {
    let conn = open_connection(profile_id)?;
    conn.execute(
        "DELETE FROM datacards WHERE folder_id = ?1",
        params![folder_id],
    )
    .map_err(|_| ErrorCodeString::new("DB_QUERY_FAILED"))?;
    Ok(true)
}
