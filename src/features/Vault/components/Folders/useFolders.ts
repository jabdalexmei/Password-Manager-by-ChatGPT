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

  const openCreateFolder = useCallback(() => {
    setName('');
    setError(null);
    setCreateOpen(true);
  }, []);

  const closeCreateFolder = useCallback(() => setCreateOpen(false), []);

  const submitCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('validation.folderNameRequired'));
      return;
    }

    await onCreateFolder(trimmed);
    setCreateOpen(false);
    setName('');
  }, [name, onCreateFolder, t]);

  return { isCreateOpen, name, error, openCreateFolder, closeCreateFolder, setName, submitCreate };
}
