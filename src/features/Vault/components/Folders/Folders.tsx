import React from 'react';
import { Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';

export type FolderListProps = {
  folders: Folder[];
  deletedFolders: Folder[];
  isTrashMode: boolean;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onAddFolder: () => void;
  onDeleteFolder: (id: string) => void;
  onRestoreFolder: (id: string) => void;
  onPurgeFolder: (id: string) => void;
};

export function Folders({
  folders,
  deletedFolders,
  isTrashMode,
  selectedFolderId,
  onSelectFolder,
  onAddFolder,
  onDeleteFolder,
  onRestoreFolder,
  onPurgeFolder,
}: FolderListProps) {
  const { t } = useTranslation('Vault');
  const list = isTrashMode ? deletedFolders : folders;

  return (
    <div className="vault-panel">
      <div className="vault-panel-header">
        <span>{t('foldersTitle')}</span>
        {!isTrashMode && (
          <button type="button" className="btn btn-primary" onClick={onAddFolder}>
            {t('addFolder')}
          </button>
        )}
      </div>
      <ul className="vault-folder-list">
        <li className={!selectedFolderId ? 'active' : ''}>
          <button type="button" className="vault-folder" onClick={() => onSelectFolder(null)}>
            <span className="folder-name">{t('all')}</span>
          </button>
        </li>
        {list.map((folder) => (
          <li key={folder.id} className={selectedFolderId === folder.id ? 'active' : ''}>
            <div className="vault-folder-row">
              <button type="button" className="vault-folder" onClick={() => onSelectFolder(folder.id)}>
                <span className="folder-name">{folder.name}</span>
              </button>
              {!isTrashMode && !folder.isSystem && (
                <button className="btn btn-danger" type="button" onClick={() => onDeleteFolder(folder.id)}>
                  {t('delete')}
                </button>
              )}
              {isTrashMode && (
                <div className="vault-folder-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => onRestoreFolder(folder.id)}>
                    {t('restore')}
                  </button>
                  <button className="btn btn-danger" type="button" onClick={() => onPurgeFolder(folder.id)}>
                    {t('purge')}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
