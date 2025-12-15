import { invoke } from '@tauri-apps/api/core';
import { BackendDataCard, BackendFolder, BackendUserSettings } from '../types/backend';

export async function listFolders(): Promise<BackendFolder[]> {
  return invoke('list_folders');
}

export async function listDeletedFolders(): Promise<BackendFolder[]> {
  return invoke('list_deleted_folders');
}

export async function createFolder(input: { name: string; parent_id: string | null }): Promise<BackendFolder> {
  return invoke('create_folder', { input });
}

export async function renameFolder(input: { id: string; name: string }): Promise<boolean> {
  return invoke('rename_folder', { input });
}

export async function moveFolder(input: { id: string; parent_id: string | null }): Promise<boolean> {
  return invoke('move_folder', { input });
}

export async function deleteFolder(id: string): Promise<boolean> {
  return invoke('delete_folder', { id });
}

export async function restoreFolder(id: string): Promise<boolean> {
  return invoke('restore_folder', { id });
}

export async function purgeFolder(id: string): Promise<boolean> {
  return invoke('purge_folder', { id });
}

export async function listDataCards(): Promise<BackendDataCard[]> {
  return invoke('list_datacards');
}

export async function listDeletedDataCards(): Promise<BackendDataCard[]> {
  return invoke('list_deleted_datacards');
}

export async function getDataCard(id: string): Promise<BackendDataCard> {
  return invoke('get_datacard', { id });
}

export async function createDataCard(input: any): Promise<BackendDataCard> {
  return invoke('create_datacard', { input });
}

export async function updateDataCard(input: any): Promise<boolean> {
  return invoke('update_datacard', { input });
}

export async function moveDataCardToFolder(input: { id: string; folder_id: string | null }): Promise<boolean> {
  return invoke('move_datacard_to_folder', { input });
}

export async function deleteDataCard(id: string): Promise<boolean> {
  return invoke('delete_datacard', { id });
}

export async function restoreDataCard(id: string): Promise<boolean> {
  return invoke('restore_datacard', { id });
}

export async function purgeDataCard(id: string): Promise<boolean> {
  return invoke('purge_datacard', { id });
}

export async function getSettings(): Promise<BackendUserSettings> {
  return invoke('get_settings');
}

export async function updateSettings(settings: BackendUserSettings): Promise<BackendUserSettings | boolean> {
  return invoke('update_settings', { settings });
}
