import React from 'react';
import { Folder } from '../../types/ui';
import { SelectedNav } from '../../useVault';
import { useTranslation } from '../../../../lib/i18n';
import { FolderDialogState } from './useFolders';

type Counts = {
  all: number;
  favorites: number;
  archive: number;
  deleted: number;
  folders: Record<string, number>;
};

export type FolderListProps = {
  folders: Folder[];
  deletedFolders: Folder[];
  counts: Counts;
  selectedNav: SelectedNav;
  selectedFolderId: string | null;
  onSelectNav: (nav: SelectedNav) => void;
  dialogState: FolderDialogState;
};

export function Folders({
  folders,
  deletedFolders,
  counts,
  selectedNav,
  selectedFolderId,
  onSelectNav,
  dialogState,
}: FolderListProps) {
  const { t } = useTranslation('Folders');
  const { t: tCommon } = useTranslation('Common');
  const isTrashMode = selectedNav === 'deleted';

  const renderCreateDialog = () => {
    if (!dialogState.isCreateOpen) return null;

    return (
      <div className="dialog-backdrop">
        <div className="dialog">
          <div className="dialog-header">
            <div>
              <h3 className="dialog-title">{t('dialog.newFolder.title')}</h3>
              <p className="dialog-description">{t('dialog.newFolder.description')}</p>
            </div>
            <button
              className="dialog-close"
              aria-label={tCommon('action.close')}
              type="button"
              onClick={dialogState.closeCreateFolder}
            >
              ×
            </button>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="folder-name">
                {t('dialog.newFolder.label')}
              </label>
              <input
                id="folder-name"
                value={dialogState.name}
                onChange={(e) => dialogState.setName(e.target.value)}
                placeholder={t('dialog.newFolder.placeholder')}
              />
              {dialogState.error && <div className="form-error">{dialogState.error}</div>}
            </div>
          </div>

          <div className="dialog-actions">
            <button className="btn btn-outline" type="button" onClick={dialogState.closeCreateFolder}>
              {tCommon('action.cancel')}
            </button>
            <button className="btn btn-primary" type="button" onClick={dialogState.submitCreate}>
              {tCommon('action.ok')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSystemItem = (
    key: SelectedNav,
    label: string,
    count: number,
    isActive: boolean
  ) => (
    <li className={isActive ? 'active' : ''}>
      <button className="vault-folder" type="button" onClick={() => onSelectNav(key)}>
        <span className="folder-name">{label}</span>
        <span className="folder-count">{count}</span>
      </button>
    </li>
  );

  const renderFolder = (folder: Folder) => {
    const isActive = selectedFolderId === folder.id;
    const count = counts.folders[folder.id] ?? 0;

    if (isTrashMode) {
      return (
        <li key={folder.id}>
          <div className="vault-folder" aria-label={folder.name}>
            <span className="folder-name">{folder.name}</span>
          </div>
        </li>
      );
    }

    return (
      <li key={folder.id} className={isActive ? 'active' : ''}>
        <button className="vault-folder" type="button" onClick={() => onSelectNav({ folderId: folder.id })}>
          <span className="folder-name">{folder.name}</span>
          <span className="folder-count">{count}</span>
        </button>
      </li>
    );
  };

  return (
    <div>
      <div className="vault-sidebar-title">{t('title')}</div>
      <ul className="vault-folder-list">
        {renderSystemItem('all', t('nav.allItems'), counts.all, selectedNav === 'all')}
        {renderSystemItem('favorites', t('nav.favorites'), counts.favorites, selectedNav === 'favorites')}
        {renderSystemItem('archive', t('nav.archive'), counts.archive, selectedNav === 'archive')}
        {renderSystemItem('deleted', t('nav.deleted'), counts.deleted, selectedNav === 'deleted')}
        {!isTrashMode && folders.filter((folder) => !folder.isSystem).map(renderFolder)}
        {isTrashMode && deletedFolders.map(renderFolder)}
      </ul>
      {renderCreateDialog()}
    </div>
  );
}
