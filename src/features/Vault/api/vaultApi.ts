import { invoke } from '@tauri-apps/api/core';
import {
  BackendCreateDataCardInput,
  BackendDataCard,
  BackendDataCardSummary,
  BackendFolder,
  BackendAttachmentMeta,
  BackendUpdateDataCardInput,
  BackendUserSettings,
  BackendAttachmentPreviewPayload,
} from '../types/backend';

export async function listFolders(): Promise<BackendFolder[]> {
  return invoke('list_folders');
}

export async function createFolder(input: { name: string; parent_id: string | null }): Promise<BackendFolder> {
  return invoke('create_folder', { input });
}

export async function renameFolder(input: { id: string; name: string }): Promise<boolean> {
  return invoke('rename_folder', { input });
}

export async function deleteFolderOnly(id: string): Promise<boolean> {
  return invoke('delete_folder_only', { id });
}

export async function deleteFolderAndCards(id: string): Promise<boolean> {
  return invoke('delete_folder_and_cards', { id });
}

export async function listDataCardSummaries(): Promise<BackendDataCardSummary[]> {
  return invoke('list_datacards_summary_command');
}

export async function listDeletedDataCardSummaries(): Promise<BackendDataCardSummary[]> {
  return invoke('list_deleted_datacards_summary_command');
}

export async function getDataCard(id: string): Promise<BackendDataCard> {
  return invoke('get_datacard', { id });
}

export async function createDataCard(input: BackendCreateDataCardInput): Promise<BackendDataCard> {
  return invoke('create_datacard', { input });
}

export async function updateDataCard(input: BackendUpdateDataCardInput): Promise<boolean> {
  return invoke('update_datacard', { input });
}

export async function setDataCardFavorite(input: { id: string; is_favorite: boolean }): Promise<boolean> {
  return invoke('set_datacard_favorite', { input });
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

export async function listAttachments(datacardId: string): Promise<BackendAttachmentMeta[]> {
  return invoke('list_attachments', { datacardId });
}

export async function addAttachmentFromPath(
  datacardId: string,
  sourcePath: string
): Promise<BackendAttachmentMeta> {
  return invoke('add_attachment_from_path', { datacardId, sourcePath });
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  return invoke('remove_attachment', { attachmentId });
}

export async function purgeAttachment(attachmentId: string): Promise<void> {
  return invoke('purge_attachment', { attachmentId });
}

export async function saveAttachmentToPath(
  attachmentId: string,
  targetPath: string
): Promise<void> {
  return invoke('save_attachment_to_path', { attachmentId, targetPath });
}

export type AttachmentPreviewDto = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  bytesBase64: string;
};

export async function getAttachmentBytesBase64(
  attachmentId: string
): Promise<AttachmentPreviewDto> {
  const payload = await invoke<BackendAttachmentPreviewPayload>('get_attachment_bytes_base64', {
    attachmentId,
  });

  return {
    attachmentId: payload.attachment_id,
    fileName: payload.file_name,
    mimeType: payload.mime_type,
    byteSize: payload.byte_size,
    bytesBase64: payload.base64_data,
  };
}
