import React, { useEffect, useRef, useState } from 'react';
import { Folder } from '../../types/ui';
import { SelectedNav } from '../../hooks/useVault';
import { useTranslation } from '../../../../lib/i18n';
import { FolderDialogState } from './useFolders';

type Counts = {
  all: number;
  favorites: number;
  archive: number;
  deleted: number;
  folders: Record<string, number>;
};

export type VaultCategory = 'data_cards' | 'bank_cards';

export type FolderListProps = {
  selectedCategory: VaultCategory;
  onSelectCategory: (category: VaultCategory) => void;
  onAddBankCard: () => void;
  folders: Folder[];
  counts: Counts;
  selectedNav: SelectedNav;
  selectedFolderId: string | null;
  onSelectNav: (nav: SelectedNav) => void;
  dialogState: FolderDialogState;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void | Promise<void>;
};

export function Folders({
  selectedCategory,
  onSelectCategory,
  onAddBankCard,
  folders,
  counts,
  selectedNav,
  selectedFolderId,
  onSelectNav,
  dialogState,
  onDeleteFolder,
  onRenameFolder,
}: FolderListProps) {
  const { t } = useTranslation('Folders');
  const { t: tCommon } = useTranslation('Common');
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<{ x: number; y: number } | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (dialogState.isCreateOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [dialogState.isCreateOpen]);

  useEffect(() => {
    if (renameTargetId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renameTargetId]);

  useEffect(() => {
    if (!contextMenu && !categoryMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setCategoryMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categoryMenu, contextMenu]);

  const renderCreateDialog = () => {
    if (!dialogState.isCreateOpen || selectedCategory === 'bank_cards') return null;

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      void dialogState.submitCreate();
    };

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="dialog-header">
            <h2 id="dialog-title" className="dialog-title">
              {t('dialog.newFolder.title')}
            </h2>
          </div>

          <form className="dialog-body" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor="folder-name">
                {t('dialog.newFolder.label')}
              </label>
              <input
                id="folder-name"
                className="input"
                ref={nameInputRef}
                value={dialogState.name}
                onChange={(e) => dialogState.setName(e.target.value)}
                placeholder={t('dialog.newFolder.placeholder')}
              />
              {dialogState.error && <div className="form-error">{dialogState.error}</div>}
            </div>

            <div className="dialog-footer">
              <button className="btn btn-secondary" type="button" onClick={dialogState.closeCreateFolder}>
                {tCommon('action.cancel')}
              </button>
              <button className="btn btn-primary" type="submit" disabled={dialogState.isSubmitting}>
                {t('action.create')}
              </button>
            </div>
          </form>
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

    return (
      <li key={folder.id} className={isActive ? 'active' : ''}>
        <button
          className="vault-folder"
          type="button"
          onClick={() => onSelectNav({ folderId: folder.id })}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ folderId: folder.id, x: event.clientX, y: event.clientY });
          }}
        >
          <span className="folder-name">{folder.name}</span>
          <span className="folder-count">{count}</span>
        </button>
      </li>
    );
  };

  const closeContextMenu = () => setContextMenu(null);
  const closeCategoryMenu = () => setCategoryMenu(null);

  const openRenameDialog = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    setContextMenu(null);
    setRenameTargetId(folder.id);
    setRenameName(folder.name);
    setRenameError(null);
    setIsRenaming(false);
  };

  const closeRenameDialog = () => {
    setRenameTargetId(null);
    setRenameName('');
    setRenameError(null);
    setIsRenaming(false);
  };

  const submitRename = async () => {
    if (!renameTargetId || isRenaming) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      setRenameError(t('validation.folderNameRequired'));
      return;
    }

    setIsRenaming(true);
    try {
      await onRenameFolder(renameTargetId, trimmed);
      closeRenameDialog();
    } finally {
      setIsRenaming(false);
    }
  };

  const renderRenameDialog = () => {
    if (!renameTargetId || selectedCategory === 'bank_cards') return null;

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      void submitRename();
    };

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-folder-title">
          <div className="dialog-header">
            <h2 id="rename-folder-title" className="dialog-title">
              {t('dialog.renameFolder.title')}
            </h2>
          </div>

          <form className="dialog-body" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor="rename-folder-name">
                {t('dialog.renameFolder.label')}
              </label>
              <input
                id="rename-folder-name"
                className="input"
                ref={renameInputRef}
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder={t('dialog.renameFolder.placeholder')}
              />
              {renameError && <div className="form-error">{renameError}</div>}
            </div>

            <div className="dialog-footer">
              <button className="btn btn-secondary" type="button" onClick={closeRenameDialog}>
                {tCommon('action.cancel')}
              </button>
              <button className="btn btn-primary" type="submit" disabled={isRenaming}>
                {t('action.rename')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleDeleteFromMenu = (folderId: string) => {
    closeContextMenu();
    onDeleteFolder(folderId);
  };

  return (
    <div>
      <div className="vault-sidebar-title">{t('category.title')}</div>
      <ul className="vault-folder-list">
        <li className={selectedCategory === 'data_cards' ? 'active' : ''}>
          <button className="vault-folder" type="button" onClick={() => onSelectCategory('data_cards')}>
            <span className="folder-name">{t('category.dataCards')}</span>
          </button>
        </li>
        <li className={selectedCategory === 'bank_cards' ? 'active' : ''}>
          <button
            className="vault-folder"
            type="button"
            onClick={() => onSelectCategory('bank_cards')}
            onContextMenu={(event) => {
              event.preventDefault();
              setCategoryMenu({ x: event.clientX, y: event.clientY });
            }}
          >
            <span className="folder-name">{t('category.bankCards')}</span>
          </button>
        </li>
      </ul>
      <div className="vault-sidebar-title">{t('nav.title')}</div>
      <ul className="vault-folder-list">
        {renderSystemItem('all', t('nav.allItems'), counts.all, selectedNav === 'all')}
        {renderSystemItem('favorites', t('nav.favorites'), counts.favorites, selectedNav === 'favorites')}
        {renderSystemItem('archive', t('nav.archive'), counts.archive, selectedNav === 'archive')}
        {renderSystemItem('deleted', t('nav.deleted'), counts.deleted, selectedNav === 'deleted')}
      </ul>
      {selectedCategory === 'data_cards' && (
        <>
          <div className="vault-sidebar-title">{t('title')}</div>
          <ul className="vault-folder-list">{folders.filter((folder) => !folder.isSystem).map(renderFolder)}</ul>
        </>
      )}
      {renderCreateDialog()}
      {renderRenameDialog()}

      {contextMenu && (
        <div className="vault-context-backdrop" onClick={closeContextMenu} onContextMenu={(event) => event.preventDefault()}>
          <div
            className="vault-context-menu"
            role="menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="vault-context-item" onClick={() => openRenameDialog(contextMenu.folderId)}>
              {t('action.renameFolder')}
            </button>
            <button type="button" className="vault-context-item" onClick={() => handleDeleteFromMenu(contextMenu.folderId)}>
              {t('action.deleteFolder')}
            </button>
          </div>
        </div>
      )}

      {categoryMenu && (
        <div
          className="vault-context-backdrop"
          onClick={closeCategoryMenu}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="vault-context-menu"
            role="menu"
            style={{ top: categoryMenu.y, left: categoryMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="vault-context-item"
              onClick={() => {
                onAddBankCard();
                closeCategoryMenu();
              }}
            >
              {t('action.addBankCard')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
