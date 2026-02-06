import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Folder } from '../../types/ui';
import { SelectedNav } from '../../hooks/useVault';
import { useTranslation } from '../../../../shared/lib/i18n';
import { FolderDialogState } from './useFolders';

type Counts = {
  all: number;
  favorites: number;
  archive: number;
  deleted: number;
  folders: Record<string, number>;
};

export type VaultCategory = 'data_cards' | 'bank_cards' | 'all_items';

export type FolderListProps = {
  selectedCategory: VaultCategory;
  onSelectCategory: (category: VaultCategory) => void;
  onAddBankCard: () => void;
  folders: Folder[];
  counts: Counts;
  categoryCounts?: { dataCards: number; bankCards: number };
  selectedNav: SelectedNav;
  selectedFolderId: string | null;
  onSelectNav: (nav: SelectedNav) => void;
  dialogState: FolderDialogState;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void | Promise<void>;
};

type FolderTreeNode = {
  folder: Folder;
  children: FolderTreeNode[];
};

const compareFoldersForTree = (a: Folder, b: Folder) => {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
};

const buildFolderTree = (folders: Folder[]): FolderTreeNode[] => {
  const sorted = [...folders].sort(compareFoldersForTree);
  const nodesById = new Map<string, FolderTreeNode>();

  for (const folder of sorted) {
    nodesById.set(folder.id, { folder, children: [] });
  }

  const roots: FolderTreeNode[] = [];
  for (const folder of sorted) {
    const node = nodesById.get(folder.id);
    if (!node) continue;

    const parentId = folder.parentId;
    if (parentId && parentId !== folder.id) {
      const parentNode = nodesById.get(parentId);
      if (parentNode) {
        parentNode.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  // Keep cyclic or broken items visible as roots instead of dropping them.
  const seen = new Set<string>();
  const visit = (node: FolderTreeNode) => {
    if (seen.has(node.folder.id)) return;
    seen.add(node.folder.id);
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const node of roots) {
    visit(node);
  }

  for (const folder of sorted) {
    if (!seen.has(folder.id)) {
      roots.push({ folder, children: [] });
    }
  }

  return roots;
};
export function Folders({
  selectedCategory,
  onSelectCategory,
  onAddBankCard,
  folders,
  counts,
  categoryCounts,
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
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const userFolders = useMemo(() => folders.filter((folder) => !folder.isSystem), [folders]);
  const folderTree = useMemo(() => buildFolderTree(userFolders), [userFolders]);

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
    // Close rename dialog when opening create folder dialog to avoid overlapping modals
    if (dialogState.isCreateOpen && renameTargetId) {
      closeRenameDialog();
    }
  }, [dialogState.isCreateOpen, renameTargetId]);

  useEffect(() => {
    const validIds = new Set(userFolders.map((folder) => folder.id));
    setCollapsedFolderIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [userFolders]);

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
    if (!dialogState.isCreateOpen) return null;

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

          <form className="dialog-body" onSubmit={handleSubmit} autoComplete="off">
            <div className="form-field">
              <label className="form-label" htmlFor="folder-name">
                {t('dialog.newFolder.label')}
              </label>
              {dialogState.parentName && (
                <div className="form-label">{t('dialog.newFolder.parent', { name: dialogState.parentName })}</div>
              )}
              <input
                id="folder-name"
                className="input"
                autoComplete="off"
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
    if (!renameTargetId) return null;

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

          <form className="dialog-body" onSubmit={handleSubmit} autoComplete="off">
            <div className="form-field">
              <label className="form-label" htmlFor="rename-folder-name">
                {t('dialog.renameFolder.label')}
              </label>
              <input
                id="rename-folder-name"
                className="input"
                autoComplete="off"
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

  const handleCreateSubfolderFromMenu = (folderId: string) => {
    const folder = userFolders.find((item) => item.id === folderId);
    if (!folder) return;
    closeContextMenu();
    dialogState.openCreateFolder(folder.id, folder.name);
  };

  const toggleFolderCollapsed = (folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderFolderNode = (node: FolderTreeNode, depth: number, ancestors: Set<string>) => {
    const folder = node.folder;
    const isActive = selectedFolderId === folder.id;
    const count = counts.folders[folder.id] ?? 0;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedFolderIds.has(folder.id);
    const hasCycle = ancestors.has(folder.id);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(folder.id);

    return (
      <li key={folder.id} className={isActive ? 'active' : ''}>
        <div className="vault-folder-node" style={{ paddingLeft: `${depth * 14}px` }}>
          {hasChildren ? (
            <button
              type="button"
              className="vault-folder-toggle"
              aria-label={isCollapsed ? t('action.expandFolder') : t('action.collapseFolder')}
              onClick={() => toggleFolderCollapsed(folder.id)}
            >
              <span aria-hidden="true">{isCollapsed ? '>' : 'v'}</span>
            </button>
          ) : (
            <span className="vault-folder-toggle-placeholder" aria-hidden="true" />
          )}

          <button
            className="vault-folder vault-folder--tree"
            type="button"
            onClick={() => onSelectNav(isActive ? 'all' : { folderId: folder.id })}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ folderId: folder.id, x: event.clientX, y: event.clientY });
            }}
          >
            <span className="folder-name">{folder.name}</span>
            <span className="folder-count">{count}</span>
          </button>
        </div>

        {!hasCycle && hasChildren && !isCollapsed && (
          <ul className="vault-folder-tree-children">
            {node.children.map((child) => renderFolderNode(child, depth + 1, nextAncestors))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      <div className="vault-sidebar-title">{t('category.title')}</div>
      <ul className="vault-folder-list">
        {categoryCounts && (
          <li className={selectedCategory === 'data_cards' ? 'active' : ''}>
            <button className="vault-folder" type="button" onClick={() => onSelectCategory('data_cards')}>
              <span className="folder-name">{t('category.dataCards')}</span>
              <span className="folder-count">{categoryCounts.dataCards}</span>
            </button>
          </li>
        )}
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
            <span className="folder-count">{categoryCounts?.bankCards ?? counts.all}</span>
          </button>
        </li>
      </ul>
      <div className="vault-sidebar-title">{t('nav.title')}</div>
      <ul className="vault-folder-list">
        {renderSystemItem(
          'all',
          t('nav.allItems'),
          counts.all,
          selectedNav === 'all' && selectedCategory === 'all_items'
        )}
        {renderSystemItem(
          'favorites',
          t('nav.favorites'),
          counts.favorites,
          selectedNav === 'favorites' && selectedCategory === 'all_items'
        )}
        {renderSystemItem(
          'archive',
          t('nav.archive'),
          counts.archive,
          selectedNav === 'archive' && selectedCategory === 'all_items'
        )}
        {renderSystemItem(
          'deleted',
          t('nav.deleted'),
          counts.deleted,
          selectedNav === 'deleted' && selectedCategory === 'all_items'
        )}
      </ul>
      <div className="vault-sidebar-title">{t('title')}</div>
      <ul className="vault-folder-list">
        {folderTree.map((node) => renderFolderNode(node, 0, new Set<string>()))}
      </ul>
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
            <button
              type="button"
              className="vault-context-item"
              onClick={() => handleCreateSubfolderFromMenu(contextMenu.folderId)}
            >
              {t('action.addSubfolder')}
            </button>
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
