export type BackendFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type BackendBankCard = {
  holder: string;
  number: string;
  expiry_mm_yy: string;
  cvc: string;
  note: string | null;
};

export type BackendCustomFieldType = "text" | "secret" | "url" | "number" | "date";

export type BackendCustomField = {
  key: string;
  value: string;
  type: BackendCustomFieldType;
};

export type BackendDataCard = {
  id: string;
  folder_id: string | null;
  title: string;
  url: string | null;
  email: string | null;
  username: string | null;
  mobile_phone: string | null;
  note: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  password: string | null;
  bank_card: BackendBankCard | null;
  custom_fields: BackendCustomField[];
};

export type BackendCreateDataCardInput = {
  folder_id: string | null;
  title: string;
  url: string | null;
  email: string | null;
  username: string | null;
  mobile_phone: string | null;
  note: string | null;
  tags: string[];
  password: string | null;
  bank_card: BackendBankCard | null;
  custom_fields: BackendCustomField[];
};

export type BackendUpdateDataCardInput = BackendCreateDataCardInput & {
  id: string;
};

export type BackendUserSettings = {
  auto_hide_secret_timeout_seconds: number;
  auto_lock_enabled: boolean;
  auto_lock_timeout: number;
  reveal_requires_confirmation: boolean;
  clipboard_clear_timeout_seconds: number;
  soft_delete_enabled: boolean;
  trash_retention_days: number;
  backups_enabled: boolean;
  backup_frequency: "daily" | "weekly" | "monthly";
  backup_retention_days: number;
  default_sort_field: "created_at" | "updated_at" | "title";
  default_sort_direction: "ASC" | "DESC";
  mask_password_by_default: boolean;
};
