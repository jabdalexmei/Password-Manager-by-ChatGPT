import { useCallback, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { Folder } from '../../types/ui';

type UseFoldersParams = {
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void;
};

export type FolderDialogState = {
  isCreateOpen: boolean;
  name: string;
  error: string | null;
  isSubmitting: boolean;
  openCreateFolder: () => void;
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

  const openCreateFolder = useCallback(() => {
    setName('');
    setError(null);
    setIsSubmitting(false);
    setCreateOpen(true);
  }, []);

  const closeCreateFolder = useCallback(() => {
    setIsSubmitting(false);
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
      await onCreateFolder(trimmed);
      setCreateOpen(false);
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, name, onCreateFolder, t]);

  return { isCreateOpen, name, error, isSubmitting, openCreateFolder, closeCreateFolder, setName, submitCreate };
}
