import { invoke } from '@tauri-apps/api/core';

export type ProfileMeta = {
  id: string;
  name: string;
  has_password: boolean;
};

export type ProfilesList = {
  profiles: ProfileMeta[];
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

export async function autoLockCleanup(): Promise<boolean> {
  return invoke('auto_lock_cleanup');
}

export async function healthCheck(): Promise<boolean> {
  return invoke('health_check');
}
