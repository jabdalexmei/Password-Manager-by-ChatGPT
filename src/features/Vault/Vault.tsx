import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useVault, type SelectedNav } from './hooks/useVault';
import { VaultHeader } from './components/Header/VaultHeader';
import { Search } from './components/Search/Search';
import { Folders } from './components/Folders/Folders';
import { DataCards } from './components/DataCards/DataCards';
import { useDataCards } from './components/DataCards/useDataCards';
import { useFolders } from './components/Folders/useFolders';
import { useBankCards } from './hooks/useBankCards';
import { useBankCardsViewModel } from './components/BankCards/useBankCardsViewModel';
import { BankCards } from './components/BankCards/BankCards';
import { BankCardDetails } from './components/BankCards/BankCardDetails';
import { useTranslation } from '../../shared/lib/i18n';
import { useToaster } from '../../shared/components/Toaster';
import {
  backupPickFile,
  backupDiscardPick,
  createBackupIfDueAuto,
  restoreBackupWorkflowFromPick,
} from './api/vaultApi';
import { BackendUserSettings } from './types/backend';
import type { VaultCategory } from './components/Folders/Folders';

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

type VaultProps = {
  profileId: string;
  profileName: string;
  isPasswordless: boolean;
  onLocked: () => void;
};

export default function Vault({ profileId, profileName, isPasswordless, onLocked }: VaultProps) {
  const vault = useVault(profileId, onLocked);
  const bankCards = useBankCards(profileId, onLocked, vault.folders);
  const { t: tDataCards } = useTranslation('DataCards');
  const { t: tBankCards } = useTranslation('BankCards');
  const { t: tFolders } = useTranslation('Folders');
  const { t: tVault } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const { t: tDetails } = useTranslation('Details');
  const { show: showToast } = useToaster();

  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>('data_cards');
  const [activeDetailsKind, setActiveDetailsKind] = useState<'data' | 'bank'>('data');

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [pendingImportToken, setPendingImportToken] = useState<string | null>(null);
  const [pendingImportLabel, setPendingImportLabel] = useState<string | null>(null);
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
    onSelectCard: (id) => {
      vault.selectCard(id);
      bankCards.selectCard(null);
      setActiveDetailsKind('data');
    },
    onCreateCard: vault.createCard,
    onUploadAttachments: vault.uploadAttachments,
    onUpdateCard: vault.updateCard,
    onDeleteCard: vault.deleteCard,
    onRestoreCard: vault.restoreCard,
    onPurgeCard: vault.purgeCard,
    onRestoreAllTrash: vault.restoreAllTrash,
    onPurgeAllTrash: vault.purgeAllTrash,
  });

  const bankCardsViewModel = useBankCardsViewModel({
    cards: bankCards.visibleCards,
    defaultFolderId: typeof bankCards.selectedNav === 'object' ? bankCards.selectedNav.folderId : null,
    selectedCardId: bankCards.selectedCardId,
    isTrashMode: bankCards.isTrashMode,
    onSelectCard: (id) => {
      bankCards.selectCard(id);
      vault.selectCard(null);
      setActiveDetailsKind('bank');
    },
    onCreateCard: bankCards.createCard,
    onUpdateCard: bankCards.updateCard,
    onDeleteCard: bankCards.deleteCard,
    onRestoreCard: bankCards.restoreCard,
    onPurgeCard: bankCards.purgeCard,
    onRestoreAllTrash: bankCards.restoreAllTrash,
    onPurgeAllTrash: bankCards.purgeAllTrash,
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

  const handleSelectCategory = useCallback(
    (category: VaultCategory) => {
      setSelectedCategory(category);
      setActiveDetailsKind(category === 'bank_cards' ? 'bank' : 'data');
      vault.selectCard(null);
      bankCards.selectCard(null);
    },
    [bankCards.selectCard, vault.selectCard]
  );

  const handleExportBackup = () => setExportModalOpen(true);

  const handleImportBackup = async () => {
    const picked = await backupPickFile();
    if (!picked) return;
    setPendingImportToken(picked.token);
    setPendingImportLabel(picked.fileName);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportToken) return;
    setIsRestoringBackup(true);
    try {
      await restoreBackupWorkflowFromPick(pendingImportToken);
      await backupDiscardPick(pendingImportToken);
      showToast(tVault('backup.import.success'), 'success');
      setPendingImportToken(null);
      setPendingImportLabel(null);
      onLocked();
    } catch (err) {
      handleBackupError(err);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleCloseImport = () => {
    if (isRestoringBackup) return;
    if (pendingImportToken) void backupDiscardPick(pendingImportToken);
    setPendingImportToken(null);
    setPendingImportLabel(null);
  };

  const handleOpenSettings = () => setSettingsModalOpen(true);

  const handleSaveSettings = async (nextSettings: BackendUserSettings) => {
    setIsSavingSettings(true);
    const saved = await vault.updateSettings(nextSettings);
    if (saved) {
      bankCards.setSettings(nextSettings);
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

    const cardsCount = combinedCounts.folders[folderId] ?? 0;
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
    setActiveDetailsKind('bank');
    bankCardsViewModel.openCreateModal();
  }, [bankCardsViewModel.openCreateModal]);

  const combinedCounts = useMemo(() => {
    const sumFolderCounts = (a: Record<string, number>, b: Record<string, number>) => {
      const next: Record<string, number> = { ...a };
      for (const [folderId, count] of Object.entries(b)) {
        next[folderId] = (next[folderId] || 0) + count;
      }
      return next;
    };

    return {
      all: vault.counts.all + bankCards.counts.all,
      favorites: vault.counts.favorites + bankCards.counts.favorites,
      archive: vault.counts.archive + bankCards.counts.archive,
      deleted: vault.counts.deleted + bankCards.counts.deleted,
      folders: sumFolderCounts(vault.counts.folders, bankCards.counts.folders),
    };
  }, [bankCards.counts, vault.counts]);

  const sidebarCounts = useMemo(
    () => (selectedCategory === 'data_cards' ? vault.counts : bankCards.counts),
    [selectedCategory, vault.counts, bankCards.counts]
  );

  const handleSelectNav = useCallback(
    async (nav: SelectedNav) => {
      await Promise.all([vault.selectNav(nav), bankCards.selectNav(nav)]);
      // When switching sections, clear selections to avoid showing stale details.
      vault.selectCard(null);
      bankCards.selectCard(null);
    },
    [bankCards.selectNav, bankCards.selectCard, vault.selectNav, vault.selectCard]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      vault.setSearchQuery(value);
      bankCards.setSearchQuery(value);
    },
    [bankCards.setSearchQuery, vault.setSearchQuery]
  );

  const showCombinedLists = useMemo(() => {
    if (typeof vault.selectedNav === 'object') return true;
    return vault.searchQuery.trim().length > 0;
  }, [vault.searchQuery, vault.selectedNav]);

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
        <aside className="vault-sidebar">
          <div className="vault-sidebar-controls">
            <Search
              query={vault.searchQuery}
              onChange={handleSearchChange}
              filters={selectedCategory === 'data_cards' ? vault.filters : undefined}
              onChangeFilters={selectedCategory === 'data_cards' ? vault.setFilters : undefined}
            />
          </div>
          <div className="vault-sidebar-actions">
            {selectedCategory === 'data_cards' ? (
              <button className="btn btn-primary" type="button" onClick={dataCardsViewModel.openCreateModal}>
                {tDataCards('label.addDataCard')}
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={bankCardsViewModel.openCreateModal}>
                {tBankCards('label.addBankCard')}
              </button>
            )}
            <button className="btn btn-secondary" type="button" onClick={folderDialogs.openCreateFolder}>
              {tFolders('action.addFolder')}
            </button>
          </div>
          <Folders
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            onAddBankCard={handleAddBankCard}
            folders={vault.folders}
            counts={sidebarCounts}
            selectedNav={vault.selectedNav}
            selectedFolderId={vault.selectedFolderId}
            onSelectNav={(nav) => void handleSelectNav(nav)}
            dialogState={folderDialogs}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={vault.renameFolder}
          />
        </aside>

        <section className="vault-datacards">
          {showCombinedLists ? (
            <>
              <DataCards
                viewModel={dataCardsViewModel}
                sectionTitle={`${vault.currentSectionTitle} • ${tFolders('category.dataCards')}`}
                clipboardAutoClearEnabled={vault.settings?.clipboard_auto_clear_enabled}
                clipboardClearTimeoutSeconds={vault.settings?.clipboard_clear_timeout_seconds}
              />
              <BankCards
                viewModel={bankCardsViewModel}
                sectionTitle={`${vault.currentSectionTitle} • ${tFolders('category.bankCards')}`}
                folders={vault.folders}
              />
            </>
          ) : selectedCategory === 'data_cards' ? (
            <DataCards
              viewModel={dataCardsViewModel}
              sectionTitle={vault.currentSectionTitle}
              clipboardAutoClearEnabled={vault.settings?.clipboard_auto_clear_enabled}
              clipboardClearTimeoutSeconds={vault.settings?.clipboard_clear_timeout_seconds}
            />
          ) : (
            <BankCards viewModel={bankCardsViewModel} sectionTitle={bankCards.currentSectionTitle} folders={vault.folders} />
          )}
        </section>

        <section className="vault-details">
          {activeDetailsKind === 'bank' ? (
            <BankCardDetails
              card={bankCards.selectedCard}
              onEdit={(card) => bankCardsViewModel.openEditModal(card)}
              onDelete={bankCards.deleteCard}
              onRestore={bankCards.restoreCard}
              onPurge={bankCards.purgeCard}
              onToggleFavorite={bankCards.toggleFavorite}
              isTrashMode={bankCards.isTrashMode}
              clipboardAutoClearEnabled={bankCards.settings?.clipboard_auto_clear_enabled}
              clipboardClearTimeoutSeconds={bankCards.settings?.clipboard_clear_timeout_seconds}
            />
          ) : vault.selectedCard ? (
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

      {pendingImportToken !== null && (
        <Suspense fallback={null}>
          <LazyImportBackupModal
            open={pendingImportToken !== null}
            backupPath={pendingImportLabel}
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
