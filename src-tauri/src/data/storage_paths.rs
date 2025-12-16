use std::path::PathBuf;
use std::sync::OnceLock;

#[derive(Debug, Clone)]
pub struct StoragePaths {
    app_dir: PathBuf,
    data_root: PathBuf,
    profiles_root: PathBuf,
}

impl StoragePaths {
    fn initialize() -> Result<Self, StoragePathsError> {
        let exe_path = std::env::current_exe().map_err(|_| StoragePathsError::ExecutablePath)?;
        let app_dir = exe_path
            .parent()
            .ok_or(StoragePathsError::ExecutablePath)?
            .to_path_buf();

        let data_root = app_dir.join("Data");
        let profiles_root = data_root.join("Profiles");

        std::fs::create_dir_all(&profiles_root)
            .map_err(|_| StoragePathsError::CreateProfilesDir)?;

        Ok(StoragePaths {
            app_dir,
            data_root,
            profiles_root,
        })
    }

    pub fn app_dir(&self) -> &PathBuf {
        &self.app_dir
    }

    pub fn data_root(&self) -> &PathBuf {
        &self.data_root
    }

    pub fn profiles_root(&self) -> &PathBuf {
        &self.profiles_root
    }
}

#[derive(Debug, Clone, Copy)]
pub enum StoragePathsError {
    ExecutablePath,
    CreateProfilesDir,
}

impl StoragePathsError {
    pub fn message(&self) -> &'static str {
        match self {
            StoragePathsError::ExecutablePath => {
                "Unable to determine application directory for Password Manager."
            }
            StoragePathsError::CreateProfilesDir => {
                "Password Manager cannot create the Data/Profiles folder next to the application. Please ensure write access and try again."
            }
        }
    }
}

static PATHS: OnceLock<StoragePaths> = OnceLock::new();

pub fn initialize_storage_paths() -> Result<&'static StoragePaths, StoragePathsError> {
    if let Some(paths) = PATHS.get() {
        return Ok(paths);
    }

    let initialized = StoragePaths::initialize()?;
    Ok(PATHS.get_or_init(|| initialized))
}

pub fn storage_paths() -> &'static StoragePaths {
    PATHS
        .get()
        .expect("storage paths must be initialized before use")
}
