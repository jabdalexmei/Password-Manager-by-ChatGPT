import { useCallback, useState } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { Folder } from '../../types/ui';

type UseFoldersParams = {
  onCreateFolder: (name: string, parentId: string | null) => Promise<Folder | void> | Folder | void;
};

export type FolderDialogState = {
  isCreateOpen: boolean;
  name: string;
  error: string | null;
  isSubmitting: boolean;
  openCreateFolder: (parentId?: string | null) => void;
  closeCreateFolder: () => void;
  setName: (value: string) => void;
  submitCreate: () => Promise<void>;
};

export function useFolders({ onCreateFolder }: UseFoldersParams): FolderDialogState {
  const { t } = useTranslation('Folders');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const openCreateFolder = useCallback((parentId: string | null = null) => {
    setName('');
    setError(null);
    setIsSubmitting(false);
    setCreateParentId(parentId);
    setCreateOpen(true);
  }, []);

  const closeCreateFolder = useCallback(() => {
    // Reset dialog state on cancel to avoid leaving stale data behind.
    setIsSubmitting(false);
    setCreateParentId(null);
    setCreateOpen(false);
    // Clear form fields and errors when closing the dialog
    setName('');
    setError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('validation.folderNameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateFolder(trimmed, createParentId);
      // Only close the dialog and reset state on success
      setCreateOpen(false);
      setCreateParentId(null);
      setName('');
    } catch (err: any) {
      // If folder creation fails, stay in the dialog and surface a meaningful error message.
      const code = err?.code ?? err?.error;
      if (code === 'FOLDER_NAME_EXISTS') {
        setError(t('validation.folderNameExists'));
      } else if (code === 'FOLDER_NAME_REQUIRED') {
        setError(t('validation.folderNameRequired'));
      } else {
        setError(t('error.createFolderFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [createParentId, isSubmitting, name, onCreateFolder, t]);

  return { isCreateOpen, name, error, isSubmitting, openCreateFolder, closeCreateFolder, setName, submitCreate };
}
