import { invoke } from '@tauri-apps/api/core';

import type {
  BackendAttachmentMeta,
  BackendAttachmentPreviewPayload,
  BackendBankCardItem,
  BackendBankCardSummary,
  BackendCreateBankCardInput,
  BackendCreateDataCardInput,
  BackendDataCard,
  BackendDataCardSummary,
  BackendFolder,
  BackendUpdateBankCardInput,
  BackendUpdateDataCardInput,
  BackendUserSettings,
} from '../types/backend';
import type { PasswordHistoryEntry } from '../types/ui';
import type { ProfileMeta } from '../../../shared/lib/tauri';

type ProfilesList = { profiles: ProfileMeta[] };

type AttachmentsPickItem = { id: string; fileName: string; byteSize: number };
type AttachmentsPickPayload = { token: string; files: AttachmentsPickItem[] };

type BackupPickPayload = { token: string; label: string | null };

type BackendPasswordHistoryRow = {
  id: string;
  datacard_id: string;
  password_value: string;
  created_at: string;
};

async function updateSettingsField<K extends keyof BackendUserSettings>(
  key: K,
  value: BackendUserSettings[K]
): Promise<boolean> {
  const current = await getSettings();
  const next = { ...current, [key]: value };
  return updateSettings(next);
}

export async function healthCheck(): Promise<boolean> {
  return invoke<boolean>('health_check');
}

export async function getVaultStatus(): Promise<boolean> {
  return invoke<boolean>('is_logged_in');
}

export async function lockVault(): Promise<boolean> {
  return invoke<boolean>('lock_vault');
}

/**
 * There is no dedicated backend command for “logout and cleanup”.
 * In this app “lock” is the closest safe equivalent.
 */
export async function logoutAndCleanup(): Promise<boolean> {
  try {
    return await lockVault();
  } catch {
    return false;
  }
}

export async function login(id: string, password: string | null): Promise<boolean> {
  return invoke<boolean>('login_vault', { id, password: password ?? null });
}

export async function getActiveProfile(): Promise<ProfileMeta | null> {
  return invoke<ProfileMeta | null>('get_active_profile');
}

export async function setActiveProfile(id: string): Promise<boolean> {
  return invoke<boolean>('set_active_profile', { id });
}

export async function getProfiles(): Promise<ProfilesList> {
  return invoke<ProfilesList>('profiles_list');
}

export async function createProfile(name: string, password: string | null): Promise<ProfileMeta> {
  return invoke<ProfileMeta>('profile_create', { name, password: password ?? null });
}

export async function renameProfile(id: string, name: string): Promise<ProfileMeta> {
  return invoke<ProfileMeta>('profile_rename', { id, name });
}

export async function deleteProfile(id: string): Promise<boolean> {
  return invoke<boolean>('profile_delete', { id });
}

/**
 * Returns a truthy value when backup was created. UI only needs “did it work”.
 * Backend commands currently return bool; older UI expects a path-like string.
 * This implementation supports both (string or bool) without changing the backend API.
 */
export async function createBackup(useDefaultPath: boolean, suggestedFileName: string): Promise<string | null> {
  if (useDefaultPath) {
    const result = await invoke<unknown>('backup_create', {
      destination_path: null,
      use_default_path: true,
    });
    if (typeof result === 'string') return result;
    return result === true ? suggestedFileName : null;
  }

  const result = await invoke<unknown>('backup_create_via_dialog', { file_name: suggestedFileName });
  if (typeof result === 'string') return result;
  return result === true ? suggestedFileName : null;
}

export async function createBackupIfDueAuto(): Promise<boolean> {
  return invoke<boolean>('backup_create_if_due_auto');
}

export async function backupPickFile(): Promise<BackupPickPayload> {
  return invoke<BackupPickPayload>('backup_pick_file');
}

export async function backupDiscardPick(token: string): Promise<boolean> {
  return invoke<boolean>('backup_discard_pick', { token });
}

export async function restoreBackupWorkflowFromPick(token: string): Promise<boolean> {
  return invoke<boolean>('backup_restore_workflow_from_pick', { token });
}

export async function listFolders(): Promise<BackendFolder[]> {
  return invoke<BackendFolder[]>('list_folders');
}

export async function listDeletedFolders(): Promise<BackendFolder[]> {
  return invoke<BackendFolder[]>('list_deleted_folders');
}

export async function getFolder(id: string): Promise<BackendFolder | null> {
  return invoke<BackendFolder | null>('get_folder', { id });
}

export async function createFolder(input: { name: string; parent_id: string | null }): Promise<BackendFolder> {
  return invoke<BackendFolder>('create_folder', { input });
}

export async function renameFolder(input: { id: string; name: string }): Promise<boolean> {
  return invoke<boolean>('rename_folder', { input });
}

export async function moveFolder(input: { id: string; parent_id: string | null }): Promise<boolean> {
  return invoke<boolean>('move_folder', { input });
}

export async function deleteFolderOnly(folder_id: string): Promise<boolean> {
  return invoke<boolean>('delete_folder_only', { folder_id });
}

export async function deleteFolderWithChildren(folder_id: string): Promise<boolean> {
  return invoke<boolean>('delete_folder_with_children', { folder_id });
}

export async function deleteFolderFlat(folder_id: string): Promise<boolean> {
  return invoke<boolean>('delete_folder_flat', { folder_id });
}

export async function restoreFolder(folder_id: string): Promise<boolean> {
  return invoke<boolean>('restore_folder', { folder_id });
}

export async function restoreAllDeletedFolders(): Promise<boolean> {
  return invoke<boolean>('restore_all_deleted_folders');
}

export async function purgeDeletedFolder(folder_id: string): Promise<boolean> {
  return invoke<boolean>('purge_deleted_folder', { folder_id });
}

export async function purgeAllDeletedFolders(): Promise<boolean> {
  return invoke<boolean>('purge_all_deleted_folders');
}

export async function listDataCardSummaries(): Promise<BackendDataCardSummary[]> {
  return invoke<BackendDataCardSummary[]>('list_datacards_summary_command');
}

export async function listDeletedDataCardSummaries(): Promise<BackendDataCardSummary[]> {
  return invoke<BackendDataCardSummary[]>('list_deleted_datacards_summary_command');
}

export async function getDataCard(id: string): Promise<BackendDataCard | null> {
  return invoke<BackendDataCard | null>('get_datacard', { id });
}

export async function createDataCard(input: BackendCreateDataCardInput): Promise<BackendDataCard> {
  return invoke<BackendDataCard>('create_datacard', { input });
}

export async function updateDataCard(input: BackendUpdateDataCardInput): Promise<boolean> {
  return invoke<boolean>('update_datacard', { input });
}

export async function deleteDataCard(id: string): Promise<boolean> {
  return invoke<boolean>('delete_datacard', { id });
}

export async function restoreDataCard(id: string): Promise<boolean> {
  return invoke<boolean>('restore_datacard', { id });
}

export async function restoreAllDeletedDataCards(): Promise<boolean> {
  return invoke<boolean>('restore_all_deleted_datacards');
}

export async function purgeDataCard(id: string): Promise<boolean> {
  return invoke<boolean>('purge_datacard', { id });
}

export async function purgeAllDeletedDataCards(): Promise<boolean> {
  return invoke<boolean>('purge_all_deleted_datacards');
}

export async function setDataCardArchived(id: string, archived: boolean): Promise<boolean> {
  return invoke<boolean>('set_datacard_archived', { id, archived });
}

export async function setDataCardFavorite(id: string, is_favorite: boolean): Promise<boolean> {
  return invoke<boolean>('set_datacard_favorite', { id, is_favorite });
}

export async function moveCardToFolder(input: { id: string; folder_id: string | null }): Promise<boolean> {
  return invoke<boolean>('move_datacard_to_folder', { input });
}

export async function searchDataCards(query: string): Promise<string[]> {
  return invoke<string[]>('search_datacards', { query });
}

export async function listBankCardSummaries(): Promise<BackendBankCardSummary[]> {
  return invoke<BackendBankCardSummary[]>('list_bank_cards_summary_command');
}

export async function listDeletedBankCardSummaries(): Promise<BackendBankCardSummary[]> {
  return invoke<BackendBankCardSummary[]>('list_deleted_bank_cards_summary_command');
}

export async function getBankCard(id: string): Promise<BackendBankCardItem | null> {
  return invoke<BackendBankCardItem | null>('get_bank_card', { id });
}

export async function createBankCard(input: BackendCreateBankCardInput): Promise<BackendBankCardItem> {
  return invoke<BackendBankCardItem>('create_bank_card', { input });
}

export async function updateBankCard(input: BackendUpdateBankCardInput): Promise<boolean> {
  return invoke<boolean>('update_bank_card', { input });
}

export async function deleteBankCard(id: string): Promise<boolean> {
  return invoke<boolean>('delete_bank_card', { id });
}

export async function restoreBankCard(id: string): Promise<boolean> {
  return invoke<boolean>('restore_bank_card', { id });
}

export async function restoreAllDeletedBankCards(): Promise<boolean> {
  return invoke<boolean>('restore_all_deleted_bank_cards');
}

export async function purgeBankCard(id: string): Promise<boolean> {
  return invoke<boolean>('purge_bank_card', { id });
}

export async function purgeAllDeletedBankCards(): Promise<boolean> {
  return invoke<boolean>('purge_all_deleted_bank_cards');
}

export async function setBankCardArchived(id: string, archived: boolean): Promise<boolean> {
  return invoke<boolean>('set_bankcard_archived', { id, archived });
}

export async function setBankCardFavorite(id: string, is_favorite: boolean): Promise<boolean> {
  return invoke<boolean>('set_bank_card_favorite', { id, is_favorite });
}

export async function moveBankCardToFolder(input: { id: string; folder_id: string | null }): Promise<boolean> {
  return invoke<boolean>('move_bank_card_to_folder', { input });
}

export async function searchBankCards(query: string): Promise<string[]> {
  return invoke<string[]>('search_bank_cards', { query });
}

export async function setDataCardPreviewFieldsForCard(id: string, fields: string[]): Promise<boolean> {
  return invoke<boolean>('set_datacard_preview_fields_for_card', { id, fields });
}

export async function setBankCardPreviewFieldsForCard(
  id: string,
  preview_fields: { fields: string[]; card_number_mode: string | null }
): Promise<boolean> {
  return invoke<boolean>('set_bankcard_preview_fields_for_card', { id, preview_fields });
}

export async function getDataCardPreviewFields(): Promise<{ fields: string[] }> {
  return invoke<{ fields: string[] }>('get_datacard_preview_fields');
}

export async function setDataCardPreviewFields(fields: string[]): Promise<boolean> {
  return invoke<boolean>('set_datacard_preview_fields', { fields });
}

export async function getDataCardCoreHiddenFields(): Promise<{ fields: string[] }> {
  return invoke<{ fields: string[] }>('get_datacard_core_hidden_fields');
}

export async function setDataCardCoreHiddenFields(fields: string[]): Promise<boolean> {
  return invoke<boolean>('set_datacard_core_hidden_fields', { fields });
}

export async function getBankCardPreviewFields(): Promise<{ fields: string[]; card_number_mode: string | null }> {
  return invoke<{ fields: string[]; card_number_mode: string | null }>('get_bankcard_preview_fields');
}

export async function setBankCardPreviewFields(prefs: {
  fields: string[];
  card_number_mode: string | null;
}): Promise<boolean> {
  return invoke<boolean>('set_bankcard_preview_fields', { prefs });
}

export async function getBankCardCoreHiddenFields(): Promise<{ fields: string[] }> {
  return invoke<{ fields: string[] }>('get_bankcard_core_hidden_fields');
}

export async function setBankCardCoreHiddenFields(fields: string[]): Promise<boolean> {
  return invoke<boolean>('set_bankcard_core_hidden_fields', { fields });
}

export async function listAttachments(datacard_id: string): Promise<BackendAttachmentMeta[]> {
  return invoke<BackendAttachmentMeta[]>('list_attachments', { datacard_id });
}

export async function attachmentsPickFiles(): Promise<AttachmentsPickPayload> {
  return invoke<AttachmentsPickPayload>('attachments_pick_files');
}

export async function attachmentsDiscardPick(token: string): Promise<boolean> {
  return invoke<boolean>('attachments_discard_pick', { token });
}

export async function addAttachmentsFromPick(datacard_id: string, token: string): Promise<BackendAttachmentMeta[]> {
  return invoke<BackendAttachmentMeta[]>('add_attachments_from_pick', { datacard_id, token });
}

export async function addAttachmentsViaDialog(datacard_id: string): Promise<BackendAttachmentMeta[]> {
  return invoke<BackendAttachmentMeta[]>('add_attachments_via_dialog', { datacard_id });
}

export async function removeAttachment(attachment_id: string): Promise<boolean> {
  return invoke<boolean>('remove_attachment', { attachment_id });
}

export async function saveAttachmentViaDialog(attachment_id: string, default_name: string): Promise<boolean> {
  return invoke<boolean>('save_attachment_via_dialog', { attachment_id, default_name });
}

export async function getAttachmentBytesBase64(attachment_id: string): Promise<BackendAttachmentPreviewPayload> {
  return invoke<BackendAttachmentPreviewPayload>('get_attachment_bytes_base64', { attachment_id });
}

export async function getPasswordHistory(datacardId: string): Promise<PasswordHistoryEntry[]> {
  const rows = await invoke<BackendPasswordHistoryRow[]>('get_datacard_password_history', {
    datacard_id: datacardId,
  });
  return rows.map((r) => ({
    id: r.id,
    datacardId: r.datacard_id,
    passwordValue: r.password_value,
    createdAt: r.created_at,
  }));
}

export async function clearPasswordHistory(datacardId: string): Promise<boolean> {
  return invoke<boolean>('clear_datacard_password_history', { datacard_id: datacardId });
}

export async function getSettings(): Promise<BackendUserSettings> {
  return invoke<BackendUserSettings>('get_settings');
}

export async function updateSettings(settings: BackendUserSettings): Promise<boolean> {
  return invoke<boolean>('update_settings', { settings });
}

/** Convenience helpers used by older UI code (safe to keep). */
export async function getAutoLockEnabled(): Promise<boolean> {
  return (await getSettings()).auto_lock_enabled;
}
export async function setAutoLockEnabled(enabled: boolean): Promise<boolean> {
  return updateSettingsField('auto_lock_enabled', enabled);
}
export async function getAutoLockTimeoutSeconds(): Promise<number> {
  return (await getSettings()).auto_lock_timeout;
}
export async function setAutoLockTimeoutSeconds(seconds: number): Promise<boolean> {
  return updateSettingsField('auto_lock_timeout', seconds);
}
export async function getClipboardAutoClearEnabled(): Promise<boolean> {
  return (await getSettings()).clipboard_auto_clear_enabled;
}
export async function setClipboardAutoClearEnabled(enabled: boolean): Promise<boolean> {
  return updateSettingsField('clipboard_auto_clear_enabled', enabled);
}
export async function getClipboardClearTimeoutSeconds(): Promise<number> {
  return (await getSettings()).clipboard_clear_timeout_seconds;
}
export async function setClipboardClearTimeoutSeconds(seconds: number): Promise<boolean> {
  return updateSettingsField('clipboard_clear_timeout_seconds', seconds);
}
export async function getAutoHideSecretTimeoutSeconds(): Promise<number> {
  return (await getSettings()).auto_hide_secret_timeout_seconds;
}
export async function setAutoHideSecretTimeoutSeconds(seconds: number): Promise<boolean> {
  return updateSettingsField('auto_hide_secret_timeout_seconds', seconds);
}
export async function getRevealRequiresConfirmation(): Promise<boolean> {
  return (await getSettings()).reveal_requires_confirmation;
}
export async function setRevealRequiresConfirmation(enabled: boolean): Promise<boolean> {
  return updateSettingsField('reveal_requires_confirmation', enabled);
}
export async function getMaskPasswordByDefault(): Promise<boolean> {
  return (await getSettings()).mask_password_by_default;
}
export async function setMaskPasswordByDefault(enabled: boolean): Promise<boolean> {
  return updateSettingsField('mask_password_by_default', enabled);
}
export async function getBackupsEnabled(): Promise<boolean> {
  return (await getSettings()).backups_enabled;
}
export async function setBackupsEnabled(enabled: boolean): Promise<boolean> {
  return updateSettingsField('backups_enabled', enabled);
}
export async function getAutoBackupIntervalMinutes(): Promise<number> {
  return (await getSettings()).auto_backup_interval_minutes;
}
export async function setAutoBackupIntervalMinutes(minutes: number): Promise<boolean> {
  return updateSettingsField('auto_backup_interval_minutes', minutes);
}
export async function getBackupMaxCopies(): Promise<number> {
  return (await getSettings()).backup_max_copies;
}
export async function setBackupMaxCopies(copies: number): Promise<boolean> {
  return updateSettingsField('backup_max_copies', copies);
}
export async function getBackupFrequency(): Promise<BackendUserSettings['backup_frequency']> {
  return (await getSettings()).backup_frequency;
}
export async function setBackupFrequency(freq: BackendUserSettings['backup_frequency']): Promise<boolean> {
  return updateSettingsField('backup_frequency', freq);
}
export async function getDefaultSortField(): Promise<BackendUserSettings['default_sort_field']> {
  return (await getSettings()).default_sort_field;
}
export async function setDefaultSortField(field: BackendUserSettings['default_sort_field']): Promise<boolean> {
  return updateSettingsField('default_sort_field', field);
}
export async function getDefaultSortDirection(): Promise<BackendUserSettings['default_sort_direction']> {
  return (await getSettings()).default_sort_direction;
}
export async function setDefaultSortDirection(
  dir: BackendUserSettings['default_sort_direction']
): Promise<boolean> {
  return updateSettingsField('default_sort_direction', dir);
}
export async function getSoftDeleteEnabled(): Promise<boolean> {
  return (await getSettings()).soft_delete_enabled;
}
export async function setSoftDeleteEnabled(enabled: boolean): Promise<boolean> {
  return updateSettingsField('soft_delete_enabled', enabled);
}
export async function getTrashRetentionDays(): Promise<number> {
  return (await getSettings()).trash_retention_days;
}
export async function setTrashRetentionDays(days: number): Promise<boolean> {
  return updateSettingsField('trash_retention_days', days);
}

/**
 * “Temp” helpers are kept for compatibility; they are stored locally on the UI side.
 * They are not security features, just UX helpers for forms.
 */
const TEMP_PASSWORD_KEY = 'pm.temp.password';
const TEMP_SEED_PHRASE_KEY = 'pm.temp.seed_phrase';

export function saveTempPassword(value: string): void {
  try {
    localStorage.setItem(TEMP_PASSWORD_KEY, value);
  } catch {
    // ignore
  }
}

export function getTempPassword(): string | null {
  try {
    return localStorage.getItem(TEMP_PASSWORD_KEY);
  } catch {
    return null;
  }
}

export function saveTempSeedPhrase(value: string): void {
  try {
    localStorage.setItem(TEMP_SEED_PHRASE_KEY, value);
  } catch {
    // ignore
  }
}

export function getTempSeedPhrase(): string | null {
  try {
    return localStorage.getItem(TEMP_SEED_PHRASE_KEY);
  } catch {
    return null;
  }
}
