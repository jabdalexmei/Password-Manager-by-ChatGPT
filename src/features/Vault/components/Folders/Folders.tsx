import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, VaultItem } from '../../types/ui';
import { SelectedNav } from '../../hooks/useVault';
import { useTranslation } from '../../../../shared/lib/i18n';
import { FolderDialogState } from './useFolders';
import ConfirmDialog from '../../../../shared/components/ConfirmDialog';

type Counts = {
  all: number;
  favorites: number;
  archive: number;
  deleted: number;
  folders: Record<string, number>;
};

export type VaultCategory = 'data_cards' | 'bank_cards' | 'all_items';

export type FolderListProps = {
  vaults: VaultItem[];
  activeVaultId: string;
  multiplyVaultsEnabled: boolean;
  onSelectVault: (vaultId: string) => void | Promise<void>;
  onCreateVault: (name: string) => Promise<VaultItem | void | null> | VaultItem | void | null;
  onRenameVault: (id: string, name: string) => void | Promise<void>;
  onDeleteVault: (id: string) => void | Promise<void>;
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
  vaults,
  activeVaultId,
  multiplyVaultsEnabled,
  onSelectVault,
  onCreateVault,
  onRenameVault,
  onDeleteVault,
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
  const vaultNameInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameVaultInputRef = useRef<HTMLInputElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<{ x: number; y: number } | null>(null);
  const [vaultContextMenu, setVaultContextMenu] = useState<{ vaultId: string; x: number; y: number } | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVaultId, setRenameVaultId] = useState<string | null>(null);
  const [renameVaultName, setRenameVaultName] = useState('');
  const [renameVaultError, setRenameVaultError] = useState<string | null>(null);
  const [isRenamingVault, setIsRenamingVault] = useState(false);
  const [deleteVaultTarget, setDeleteVaultTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingVault, setIsDeletingVault] = useState(false);
  const [isCreateVaultOpen, setCreateVaultOpen] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const userFolders = useMemo(() => folders.filter((folder) => !folder.isSystem), [folders]);
  const folderTree = useMemo(() => buildFolderTree(userFolders), [userFolders]);

  useEffect(() => {
    if (isCreateVaultOpen && vaultNameInputRef.current) {
      vaultNameInputRef.current.focus();
    }
  }, [isCreateVaultOpen]);

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
    if (renameVaultId && renameVaultInputRef.current) {
      renameVaultInputRef.current.focus();
    }
  }, [renameVaultId]);

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
    if (!contextMenu && !categoryMenu && !vaultContextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setCategoryMenu(null);
        setVaultContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categoryMenu, contextMenu, vaultContextMenu]);

  const openCreateVaultDialog = () => {
    setVaultName('');
    setVaultError(null);
    setIsCreatingVault(false);
    setCreateVaultOpen(true);
  };

  const closeCreateVaultDialog = () => {
    if (isCreatingVault) return;
    setCreateVaultOpen(false);
    setVaultName('');
    setVaultError(null);
  };

  const submitCreateVault = async () => {
    if (isCreatingVault) return;
    const trimmed = vaultName.trim();
    if (!trimmed) {
      setVaultError(t('validation.vaultNameRequired'));
      return;
    }

    setIsCreatingVault(true);
    try {
      const created = await onCreateVault(trimmed);
      if (created === null) return;
      setCreateVaultOpen(false);
      setVaultName('');
      setVaultError(null);
    } finally {
      setIsCreatingVault(false);
    }
  };

  const renderCreateVaultDialog = () => {
    if (!isCreateVaultOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      void submitCreateVault();
    };

    return (
      <div
        className="dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeCreateVaultDialog();
          }
        }}
      >
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-vault-title">
          <button
            className="dialog-close dialog-close--topright"
            type="button"
            aria-label={tCommon('action.close')}
            onClick={closeCreateVaultDialog}
          >
            {'\u00D7'}
          </button>
          <div className="dialog-header">
            <h2 id="create-vault-title" className="dialog-title">
              {t('dialog.newVault.title')}
            </h2>
          </div>

          <form className="dialog-body" onSubmit={handleSubmit} autoComplete="off">
            <div className="form-field">
              <label className="form-label" htmlFor="vault-name">
                {t('dialog.newVault.label')}
              </label>
              <input
                id="vault-name"
                className="input"
                autoComplete="off"
                ref={vaultNameInputRef}
                value={vaultName}
                onChange={(e) => {
                  setVaultName(e.target.value);
                  if (vaultError) setVaultError(null);
                }}
                placeholder={t('dialog.newVault.placeholder')}
              />
              {vaultError && <div className="form-error">{vaultError}</div>}
            </div>

            <div className="dialog-footer">
              <button className="btn btn-secondary" type="button" onClick={closeCreateVaultDialog}>
                {tCommon('action.cancel')}
              </button>
              <button className="btn btn-primary" type="submit" disabled={isCreatingVault}>
                {t('action.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderCreateDialog = () => {
    if (!dialogState.isCreateOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      void dialogState.submitCreate();
    };

    return (
      <div
        className="dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            dialogState.closeCreateFolder();
          }
        }}
      >
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <button
            className="dialog-close dialog-close--topright"
            type="button"
            aria-label={tCommon('action.close')}
            onClick={dialogState.closeCreateFolder}
          >
            {'\u00D7'}
          </button>
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
  const closeVaultContextMenu = () => setVaultContextMenu(null);

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

  const openRenameVaultDialog = (vaultId: string) => {
    const vault = vaults.find((item) => item.id === vaultId);
    if (!vault) return;
    setVaultContextMenu(null);
    setRenameVaultId(vault.id);
    setRenameVaultName(vault.name);
    setRenameVaultError(null);
    setIsRenamingVault(false);
  };

  const closeRenameVaultDialog = () => {
    setRenameVaultId(null);
    setRenameVaultName('');
    setRenameVaultError(null);
    setIsRenamingVault(false);
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

  const submitRenameVault = async () => {
    if (!renameVaultId || isRenamingVault) return;
    const trimmed = renameVaultName.trim();
    if (!trimmed) {
      setRenameVaultError(t('validation.vaultNameRequired'));
      return;
    }

    setIsRenamingVault(true);
    try {
      await onRenameVault(renameVaultId, trimmed);
      closeRenameVaultDialog();
    } finally {
      setIsRenamingVault(false);
    }
  };

  const renderRenameDialog = () => {
    if (!renameTargetId) return null;

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      void submitRename();
    };

    return (
      <div
        className="dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeRenameDialog();
          }
        }}
      >
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-folder-title">
          <button
            className="dialog-close dialog-close--topright"
            type="button"
            aria-label={tCommon('action.close')}
            onClick={closeRenameDialog}
          >
            {'\u00D7'}
          </button>
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

  const renderRenameVaultDialog = () => {
    if (!renameVaultId) return null;

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      void submitRenameVault();
    };

    return (
      <div
        className="dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeRenameVaultDialog();
          }
        }}
      >
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-vault-title">
          <button
            className="dialog-close dialog-close--topright"
            type="button"
            aria-label={tCommon('action.close')}
            onClick={closeRenameVaultDialog}
          >
            {'\u00D7'}
          </button>
          <div className="dialog-header">
            <h2 id="rename-vault-title" className="dialog-title">
              {t('dialog.renameVault.title')}
            </h2>
          </div>

          <form className="dialog-body" onSubmit={handleSubmit} autoComplete="off">
            <div className="form-field">
              <label className="form-label" htmlFor="rename-vault-name">
                {t('dialog.renameVault.label')}
              </label>
              <input
                id="rename-vault-name"
                className="input"
                autoComplete="off"
                ref={renameVaultInputRef}
                value={renameVaultName}
                onChange={(e) => {
                  setRenameVaultName(e.target.value);
                  if (renameVaultError) setRenameVaultError(null);
                }}
                placeholder={t('dialog.renameVault.placeholder')}
              />
              {renameVaultError && <div className="form-error">{renameVaultError}</div>}
            </div>

            <div className="dialog-footer">
              <button className="btn btn-secondary" type="button" onClick={closeRenameVaultDialog} disabled={isRenamingVault}>
                {tCommon('action.cancel')}
              </button>
              <button className="btn btn-primary" type="submit" disabled={isRenamingVault}>
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

  const handleDeleteVaultFromMenu = (vaultId: string) => {
    const vault = vaults.find((item) => item.id === vaultId);
    if (!vault) return;
    closeVaultContextMenu();
    setDeleteVaultTarget({ id: vault.id, name: vault.name });
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
              setCategoryMenu(null);
              setVaultContextMenu(null);
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
      {multiplyVaultsEnabled && (
        <>
          <div className="vault-sidebar-title">{t('vaults.title')}</div>
          <ul className="vault-folder-list">
            {vaults.map((vault) => {
              const isActive = activeVaultId === vault.id;
              return (
                <li key={vault.id} className={isActive ? 'active' : ''}>
                  <button
                    className="vault-folder"
                    type="button"
                    onClick={() => void onSelectVault(vault.id)}
                    onContextMenu={(event) => {
                      if (vault.isDefault) return;
                      event.preventDefault();
                      setContextMenu(null);
                      setCategoryMenu(null);
                      setVaultContextMenu({ vaultId: vault.id, x: event.clientX, y: event.clientY });
                    }}
                  >
                    <span className="folder-name">{vault.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="vault-sidebar-actions vault-sidebar-actions--vaults">
            <button className="btn btn-secondary" type="button" onClick={openCreateVaultDialog}>
              {t('action.addVault')}
            </button>
          </div>
        </>
      )}

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
              setContextMenu(null);
              setVaultContextMenu(null);
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
      {renderCreateVaultDialog()}
      {renderCreateDialog()}
      {renderRenameDialog()}
      {renderRenameVaultDialog()}

      {vaultContextMenu && (
        <div
          className="vault-context-backdrop"
          onClick={closeVaultContextMenu}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="vault-context-menu"
            role="menu"
            style={{ top: vaultContextMenu.y, left: vaultContextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="vault-context-item"
              onClick={() => openRenameVaultDialog(vaultContextMenu.vaultId)}
            >
              {t('action.renameVault')}
            </button>
            <button
              type="button"
              className="vault-context-item"
              onClick={() => handleDeleteVaultFromMenu(vaultContextMenu.vaultId)}
            >
              {t('action.deleteVault')}
            </button>
          </div>
        </div>
      )}

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

      <ConfirmDialog
        open={deleteVaultTarget !== null}
        title={t('dialog.deleteVault.title')}
        description={t('dialog.deleteVault.description', { name: deleteVaultTarget?.name ?? '' })}
        confirmLabel={t('dialog.deleteVault.confirm')}
        cancelLabel={tCommon('action.cancel')}
        confirmDisabled={isDeletingVault}
        cancelDisabled={isDeletingVault}
        onCancel={() => {
          if (isDeletingVault) return;
          setDeleteVaultTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteVaultTarget) return;
          setIsDeletingVault(true);
          try {
            await onDeleteVault(deleteVaultTarget.id);
          } finally {
            setIsDeletingVault(false);
            setDeleteVaultTarget(null);
          }
        }}
      />
    </div>
  );
}
