import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { Folder } from '../../types/ui';

type UseFoldersParams = {
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void;
};

type FolderDialogs = {
  openCreateFolder: () => void;
  dialogs: JSX.Element | null;
};

export function useFolders({ onCreateFolder }: UseFoldersParams): FolderDialogs {
  const { t } = useTranslation('Folders');
  const { t: tCommon } = useTranslation('Common');
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

  const dialogs = useMemo(
    () => (
      <>
        {isCreateOpen && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('dialog.newFolder.title')}</h3>
              <p className="modal-description">{t('dialog.newFolder.description')}</p>
              <label>
                {t('dialog.newFolder.label')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('dialog.newFolder.placeholder')}
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-actions">
                <button className="btn btn-primary" type="button" onClick={submitCreate}>
                  {tCommon('action.ok')}
                </button>
                <button className="btn" type="button" onClick={closeCreateFolder}>
                  {tCommon('action.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    ),
    [closeCreateFolder, error, isCreateOpen, name, submitCreate, t, tCommon]
  );

  return { openCreateFolder, dialogs };
}
