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
    setIsSubmitting(false);
    setCreateParentId(null);
    setCreateOpen(false);
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
      setCreateOpen(false);
      setCreateParentId(null);
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  }, [createParentId, isSubmitting, name, onCreateFolder, t]);

  return { isCreateOpen, name, error, isSubmitting, openCreateFolder, closeCreateFolder, setName, submitCreate };
}
