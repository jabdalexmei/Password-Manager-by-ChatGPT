import React from 'react';
import { Folder } from '../../types/ui';
import { SelectedNav } from '../../useVault';
import { useTranslation } from '../../../../lib/i18n';

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
  onDeleteFolder: (id: string) => void;
  onRestoreFolder: (id: string) => void;
  onPurgeFolder: (id: string) => void;
};

export function Folders({
  folders,
  deletedFolders,
  counts,
  selectedNav,
  selectedFolderId,
  onSelectNav,
  onDeleteFolder,
  onRestoreFolder,
  onPurgeFolder,
}: FolderListProps) {
  const { t } = useTranslation('Vault');
  const isTrashMode = selectedNav === 'deleted';

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
            <div className="vault-sidebar-actions">
              <button className="btn btn-secondary" type="button" onClick={() => onRestoreFolder(folder.id)}>
                {t('restore')}
              </button>
              <button className="btn btn-danger" type="button" onClick={() => onPurgeFolder(folder.id)}>
                {t('purge')}
              </button>
            </div>
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
        {!folder.isSystem && (
          <div className="vault-sidebar-actions">
            <button className="btn btn-danger" type="button" onClick={() => onDeleteFolder(folder.id)}>
              {t('delete')}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div>
      <div className="vault-sidebar-title">{t('foldersTitle')}</div>
      <ul className="vault-folder-list">
        {renderSystemItem('all', t('allItems'), counts.all, selectedNav === 'all')}
        {renderSystemItem('favorites', t('favorites'), counts.favorites, selectedNav === 'favorites')}
        {renderSystemItem('archive', t('archive'), counts.archive, selectedNav === 'archive')}
        {renderSystemItem('deleted', t('deleted'), counts.deleted, selectedNav === 'deleted')}
        {!isTrashMode && folders.filter((folder) => !folder.isSystem).map(renderFolder)}
        {isTrashMode && deletedFolders.map(renderFolder)}
      </ul>
    </div>
  );
}
