import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVault } from './hooks/useVault';
import { VaultHeader } from './components/Header/VaultHeader';
import { Search } from './components/Search/Search';
import { Folders } from './components/Folders/Folders';
import { DataCards } from './components/DataCards/DataCards';
import { useDataCards } from './components/DataCards/useDataCards';
import { useFolders } from './components/Folders/useFolders';
import { useTranslation } from '../../shared/lib/i18n';
import { useToaster } from '../../shared/components/Toaster';
import { createBackupIfDueAuto, restoreBackup } from './api/vaultApi';
import { BackendUserSettings } from './types/backend';
import type { FolderDialogState } from './components/Folders/useFolders';

type VaultCategory = 'data_cards' | 'bank_cards';

type BankCardsCommands = {
  openCreateModal: () => void;
  setSettings: (nextSettings: BackendUserSettings) => void;
};

const LazyExportBackupModal = React.lazy(() =>
  import('./components/modals/ExportBackupModal').then((m) => ({ default: m.ExportBackupModal })),
);
const LazyImportBackupModal = React.lazy(() =>
  import('./components/modals/ImportBackupModal').then((m) => ({ default: m.ImportBackupModal })),
);
const LazySettingsModal = React.lazy(() =>
  import('./components/modals/SettingsModal').then((m) => ({ default: m.SettingsModal })),
);
const LazyDetails = React.lazy(() =>
  import('./components/Details/Details').then((m) => ({ default: m.Details })),
);
const LazyDeleteFolderModal = React.lazy(() =>
  import('./components/modals/DeleteFolderModal').then((m) => ({ default: m.DeleteFolderModal })),
);
const LazyBankCardsBody = React.lazy(() =>
  import('./components/BankCards/BankCardsBody').then((m) => ({ default: m.BankCardsBody })),
);

type VaultProps = {
  profileId: string;
  profileName: string;
  isPasswordless: boolean;
  onLocked: () => void;
};

export default function Vault({ profileId, profileName, isPasswordless, onLocked }: VaultProps) {
  const vault = useVault(profileId, onLocked);
  const { t: tDataCards } = useTranslation('DataCards');
  const { t: tFolders } = useTranslation('Folders');
  const { t: tVault } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const { t: tDetails } = useTranslation('Details');
  const { show: showToast } = useToaster();

  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>('data_cards');
  const [bankCardsEnabled, setBankCardsEnabled] = useState(false);

  const bankCardsCommandsRef = useRef<BankCardsCommands | null>(null);
  const pendingOpenCreateBankCardRef = useRef(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    id: string;
    name: string;
    cardsCount: number;
  } | null>(null);

  const dataCardsViewModel = useDataCards({
    cards: vault.visibleCards,
    selectedCardId: vault.selectedCardId,
    isTrashMode: vault.isTrashMode,
    folders: vault.folders,
    defaultFolderId: vault.selectedFolderId,
    onSelectCard: vault.selectCard,
    onCreateCard: vault.createCard,
    onUploadAttachments: vault.uploadAttachments,
    onUpdateCard: vault.updateCard,
    onDeleteCard: vault.deleteCard,
    onRestoreCard: vault.restoreCard,
    onPurgeCard: vault.purgeCard,
    onRestoreAllTrash: vault.restoreAllTrash,
    onPurgeAllTrash: vault.purgeAllTrash,
  });

  const folderDialogs = useFolders({ onCreateFolder: (name) => vault.createFolder(name, null) });

  const foldersForCards = useMemo(() => vault.folders, [vault.folders]);

  const handleBackupError = useCallback(
    (err: any) => {
      const code = err?.code ?? err?.error ?? 'UNKNOWN';
      if (code === 'VAULT_LOCKED') {
        onLocked();
        return;
      }
      showToast(`${tCommon('error.operationFailed')} (${code})`, 'error');
    },
    [onLocked, showToast, tCommon],
  );

  const handleSelectCategory = useCallback((category: VaultCategory) => {
    setSelectedCategory(category);
    if (category === 'bank_cards') {
      setBankCardsEnabled(true);
    }
  }, []);

  const registerBankCardsCommands = useCallback((cmds: BankCardsCommands | null) => {
    bankCardsCommandsRef.current = cmds;
    if (cmds && pendingOpenCreateBankCardRef.current) {
      pendingOpenCreateBankCardRef.current = false;
      cmds.openCreateModal();
    }
  }, []);

  const handleExportBackup = () => setExportModalOpen(true);

  const handleImportBackup = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selection = await open({
      multiple: false,
      filters: [{ name: 'Password Manager Backup', extensions: ['pmbackup', 'zip'] }],
    });
    const selectedPath = Array.isArray(selection) ? selection[0] : selection;
    if (typeof selectedPath !== 'string') return;
    setPendingImportPath(selectedPath);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportPath) return;
    setIsRestoringBackup(true);
    try {
      await restoreBackup(pendingImportPath);
      showToast(tVault('backup.import.success'), 'success');
      setPendingImportPath(null);
      onLocked();
    } catch (err) {
      handleBackupError(err);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleCloseImport = () => {
    if (isRestoringBackup) return;
    setPendingImportPath(null);
  };

  const handleOpenSettings = () => setSettingsModalOpen(true);

  const handleSaveSettings = async (nextSettings: BackendUserSettings) => {
    setIsSavingSettings(true);
    const saved = await vault.updateSettings(nextSettings);
    if (saved) {
      bankCardsCommandsRef.current?.setSettings(nextSettings);
      setSettingsModalOpen(false);
    }
    setIsSavingSettings(false);
  };

  useEffect(() => {
    if (!vault.settings?.backups_enabled) return;
    const intervalId = setInterval(() => {
      createBackupIfDueAuto()
        .then((path) => {
          if (path) {
            showToast(tVault('backup.auto.success'), 'success');
          }
        })
        .catch((err) => {
          const code = err?.code ?? err?.error ?? err?.message ?? 'UNKNOWN';
          if (code === 'BACKUP_ALREADY_RUNNING') {
            return;
          }
          handleBackupError(err);
        });
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [handleBackupError, showToast, tVault, vault.settings?.backups_enabled]);

  const handleDeleteFolder = (folderId: string) => {
    const target = vault.folders.find((folder) => folder.id === folderId);
    if (!target) return;

    const cardsCount = vault.counts.folders[folderId] ?? 0;
    setPendingFolderDelete({ id: folderId, name: target.name, cardsCount });
  };

  const closeDeleteModal = () => setPendingFolderDelete(null);

  const handleDeleteFolderOnly = async () => {
    if (!pendingFolderDelete) return;
    await vault.deleteFolderOnly(pendingFolderDelete.id);
    setPendingFolderDelete(null);
  };

  const handleDeleteFolderAndCards = async () => {
    if (!pendingFolderDelete) return;
    await vault.deleteFolderAndCards(pendingFolderDelete.id);
    setPendingFolderDelete(null);
  };

  const handleAddBankCard = useCallback(() => {
    setSelectedCategory('bank_cards');
    setBankCardsEnabled(true);

    if (bankCardsCommandsRef.current) {
      bankCardsCommandsRef.current.openCreateModal();
      return;
    }

    pendingOpenCreateBankCardRef.current = true;
  }, []);

  return (
    <div className="vault-shell">
      <VaultHeader
        profileName={profileName}
        profileId={profileId}
        isPasswordless={isPasswordless}
        onLock={vault.lock}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onOpenSettings={handleOpenSettings}
      />

      <div className="vault-body">
        {selectedCategory === 'data_cards' && (
          <>
            <aside className="vault-sidebar">
              <div className="vault-sidebar-controls">
                <Search
                  query={vault.searchQuery}
                  onChange={vault.setSearchQuery}
                  filters={vault.filters}
                  onChangeFilters={vault.setFilters}
                />
              </div>
              <div className="vault-sidebar-actions">
                <button className="btn btn-primary" type="button" onClick={dataCardsViewModel.openCreateModal}>
                  {tDataCards('label.addDataCard')}
                </button>
                <button className="btn btn-secondary" type="button" onClick={folderDialogs.openCreateFolder}>
                  {tFolders('action.addFolder')}
                </button>
              </div>
              <Folders
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                onAddBankCard={handleAddBankCard}
                folders={vault.folders}
                counts={vault.counts}
                selectedNav={vault.selectedNav}
                selectedFolderId={vault.selectedFolderId}
                onSelectNav={vault.selectNav}
                dialogState={folderDialogs}
                onDeleteFolder={handleDeleteFolder}
                onRenameFolder={vault.renameFolder}
              />
            </aside>

            <section className="vault-datacards">
              <DataCards
                viewModel={dataCardsViewModel}
                sectionTitle={vault.currentSectionTitle}
                clipboardAutoClearEnabled={vault.settings?.clipboard_auto_clear_enabled}
                clipboardClearTimeoutSeconds={vault.settings?.clipboard_clear_timeout_seconds}
              />
            </section>

            <section className="vault-details">
              {vault.selectedCard ? (
                <Suspense fallback={<p aria-busy="true">Loading…</p>}>
                  <LazyDetails
                    card={vault.selectedCard}
                    folders={foldersForCards}
                    onEdit={(card) => dataCardsViewModel.openEditModal(card)}
                    onDelete={vault.deleteCard}
                    onRestore={vault.restoreCard}
                    onPurge={vault.purgeCard}
                    onToggleFavorite={vault.toggleFavorite}
                    isTrashMode={vault.isTrashMode}
                    clipboardAutoClearEnabled={vault.settings?.clipboard_auto_clear_enabled}
                    clipboardClearTimeoutSeconds={vault.settings?.clipboard_clear_timeout_seconds}
                  />
                </Suspense>
              ) : (
                <div className="vault-panel-wrapper">
                  <div className="vault-section-header">{tVault('information.title')}</div>
                  <div className="vault-empty">{tDetails('empty.selectPrompt')}</div>
                </div>
              )}
            </section>
          </>
        )}

        {bankCardsEnabled && (
          <Suspense fallback={<p aria-busy="true">Loading…</p>}>
            <LazyBankCardsBody
              active={selectedCategory === 'bank_cards'}
              profileId={profileId}
              onLocked={onLocked}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              folders={vault.folders}
              folderDialogs={folderDialogs as FolderDialogState}
              onDeleteFolder={handleDeleteFolder}
              onRenameFolder={vault.renameFolder}
              registerCommands={registerBankCardsCommands}
            />
          </Suspense>
        )}
      </div>

      {pendingFolderDelete !== null && (
        <Suspense fallback={null}>
          <LazyDeleteFolderModal
            open={pendingFolderDelete !== null}
            folderName={pendingFolderDelete?.name ?? ''}
            cardsCount={pendingFolderDelete?.cardsCount ?? 0}
            onCancel={closeDeleteModal}
            onDeleteFolderOnly={handleDeleteFolderOnly}
            onDeleteFolderAndCards={handleDeleteFolderAndCards}
          />
        </Suspense>
      )}

      {exportModalOpen && (
        <Suspense fallback={null}>
          <LazyExportBackupModal
            open={exportModalOpen}
            profileId={profileId}
            onClose={() => setExportModalOpen(false)}
          />
        </Suspense>
      )}

      {pendingImportPath !== null && (
        <Suspense fallback={null}>
          <LazyImportBackupModal
            open={pendingImportPath !== null}
            backupPath={pendingImportPath}
            isSubmitting={isRestoringBackup}
            onCancel={handleCloseImport}
            onConfirm={handleConfirmImport}
          />
        </Suspense>
      )}

      {settingsModalOpen && (
        <Suspense fallback={null}>
          <LazySettingsModal
            open={settingsModalOpen}
            settings={vault.settings}
            isSaving={isSavingSettings}
            onCancel={() => setSettingsModalOpen(false)}
            onSave={handleSaveSettings}
          />
        </Suspense>
      )}
    </div>
  );
}
