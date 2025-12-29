import { invoke } from '@tauri-apps/api/core';

export type ProfileMeta = {
  id: string;
  name: string;
  has_password: boolean;
};

export type ProfilesList = {
  profiles: ProfileMeta[];
};

export type WorkspaceItem = {
  id: string;
  display_name: string;
  path: string;
  exists: boolean;
  valid: boolean;
  is_active: boolean;
};

export async function listProfiles(): Promise<ProfilesList> {
  return invoke('profiles_list');
}

export async function createProfile(name: string, password?: string): Promise<ProfileMeta> {
  return invoke('profile_create', { name, password: password ?? null });
}

export async function deleteProfile(id: string): Promise<boolean> {
  return invoke('profile_delete', { id });
}

export async function setActiveProfile(id: string): Promise<boolean> {
  return invoke('set_active_profile', { id });
}

export async function getActiveProfile(): Promise<ProfileMeta | null> {
  return invoke('get_active_profile');
}

export async function loginVault(id: string, password?: string): Promise<boolean> {
  return invoke('login_vault', { id, password: password ?? null });
}

export async function lockVault(): Promise<boolean> {
  return invoke('lock_vault');
}

export async function isLoggedIn(): Promise<boolean> {
  return invoke('is_logged_in');
}

export async function healthCheck(): Promise<boolean> {
  return invoke('health_check');
}

export function workspaceList(): Promise<WorkspaceItem[]> {
  return invoke('workspace_list');
}

export function workspaceSelect(id: string): Promise<boolean> {
  return invoke('workspace_select', { id });
}

export function workspaceCreate(path: string): Promise<boolean> {
  return invoke('workspace_create', { path });
}

export function workspaceCreateDefault(): Promise<boolean> {
  return invoke('workspace_create_default');
}

export function workspaceRemove(id: string): Promise<boolean> {
  return invoke('workspace_remove', { id });
}

export function workspaceOpenInExplorer(): Promise<boolean> {
  return invoke('workspace_open_in_explorer');
}

export type BackupInspectResult = {
  profile_id: string;
  profile_name: string;
  created_at_utc: string;
  vault_mode: string;
  will_overwrite: boolean;
};

export function backupInspect(backupPath: string): Promise<BackupInspectResult> {
  return invoke('backup_inspect', { backup_path: backupPath });
}

export function backupRestoreWorkflow(backupPath: string): Promise<boolean> {
  return invoke('backup_restore_workflow', { backup_path: backupPath });
}

export async function clipboardClearAll(): Promise<void> {
  await invoke('clipboard_clear_all');
}
