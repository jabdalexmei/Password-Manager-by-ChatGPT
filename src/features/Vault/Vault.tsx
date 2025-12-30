import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useVault } from './hooks/useVault';
import { VaultHeader } from './components/Header/VaultHeader';
import { Search } from './components/Search/Search';
import { Folders } from './components/Folders/Folders';
import { DataCards } from './components/DataCards/DataCards';
import { Details } from './components/Details/Details';
import { useDataCards } from './components/DataCards/useDataCards';
import { useFolders } from './components/Folders/useFolders';
import { BankCards } from './components/BankCards/BankCards';
import { BankCardDetails } from './components/BankCards/BankCardDetails';
import { useBankCardsViewModel } from './components/BankCards/useBankCardsViewModel';
import { useTranslation } from '../../shared/lib/i18n';
import { DeleteFolderModal } from './components/modals/DeleteFolderModal';
import { useBankCards } from './hooks/useBankCards';
import { useToaster } from '../../shared/components/Toaster';
import { createBackupIfDueAuto, restoreBackup } from './api/vaultApi';
import { ExportBackupModal } from './components/modals/ExportBackupModal';
import { ImportBackupModal } from './components/modals/ImportBackupModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { BackendUserSettings } from './types/backend';

type VaultProps = {
  profileId: string;
  profileName: string;
  isPasswordless: boolean;
  onLocked: () => void;
};

export default function Vault({ profileId, profileName, isPasswordless, onLocked }: VaultProps) {
  const vault = useVault(profileId, onLocked);
  const bankCards = useBankCards(profileId, onLocked);
  const { t: tDataCards } = useTranslation('DataCards');
  const { t: tBankCards } = useTranslation('BankCards');
  const { t: tFolders } = useTranslation('Folders');
  const { t: tVault } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const { show: showToast } = useToaster();
  const [selectedCategory, setSelectedCategory] = useState<'data_cards' | 'bank_cards'>('data_cards');
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
  });
  const folderDialogs = useFolders({ onCreateFolder: (name) => vault.createFolder(name, null) });
  const bankCardsViewModel = useBankCardsViewModel({
    cards: bankCards.visibleCards,
    selectedCardId: bankCards.selectedCardId,
    isTrashMode: bankCards.isTrashMode,
    onSelectCard: bankCards.selectCard,
    onCreateCard: bankCards.createCard,
    onUpdateCard: bankCards.updateCard,
    onDeleteCard: bankCards.deleteCard,
    onRestoreCard: bankCards.restoreCard,
    onPurgeCard: bankCards.purgeCard,
  });

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
    [onLocked, showToast, tCommon]
  );

  const handleExportBackup = () => setExportModalOpen(true);

  const handleImportBackup = async () => {
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
              query={selectedCategory === 'data_cards' ? vault.searchQuery : bankCards.searchQuery}
              onChange={selectedCategory === 'data_cards' ? vault.setSearchQuery : bankCards.setSearchQuery}
              filters={selectedCategory === 'data_cards' ? vault.searchFilters : bankCards.searchFilters}
                onChangeFilters={selectedCategory === 'data_cards' ? vault.setSearchFilters : bankCards.setSearchFilters}
                filterKeys={
                  selectedCategory === 'data_cards'
                    ? ['has2fa', 'hasAttachments', 'hasSeedPhrase', 'hasPhone', 'hasNotes']
                    : ['hasNotes']
                }
              />
          </div>
          <div className="vault-sidebar-actions">
            {selectedCategory === 'data_cards' ? (
              <>
                <button className="btn btn-primary" type="button" onClick={dataCardsViewModel.openCreateModal}>
                  {tDataCards('label.addDataCard')}
                </button>
                <button className="btn btn-secondary" type="button" onClick={folderDialogs.openCreateFolder}>
                  {tFolders('action.addFolder')}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" type="button" onClick={bankCardsViewModel.openCreateModal}>
                {tBankCards('label.addBankCard')}
              </button>
            )}
          </div>
          <Folders
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onAddBankCard={bankCardsViewModel.openCreateModal}
            folders={vault.folders}
            counts={selectedCategory === 'data_cards' ? vault.counts : bankCards.counts}
            selectedNav={selectedCategory === 'data_cards' ? vault.selectedNav : bankCards.selectedNav}
            selectedFolderId={selectedCategory === 'data_cards' ? vault.selectedFolderId : null}
            onSelectNav={selectedCategory === 'data_cards' ? vault.selectNav : bankCards.selectNav}
            dialogState={folderDialogs}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={vault.renameFolder}
          />
        </aside>

        <section className="vault-datacards">
          {selectedCategory === 'data_cards' ? (
            <DataCards
              viewModel={dataCardsViewModel}
              sectionTitle={vault.currentSectionTitle}
              clipboardAutoClearEnabled={vault.settings?.clipboard_auto_clear_enabled}
              clipboardClearTimeoutSeconds={vault.settings?.clipboard_clear_timeout_seconds}
            />
          ) : (
            <BankCards viewModel={bankCardsViewModel} sectionTitle={bankCards.currentSectionTitle} />
          )}
        </section>

        <section className="vault-details">
          {selectedCategory === 'data_cards' ? (
            <Details
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
          ) : (
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
          )}
        </section>
      </div>

      <DeleteFolderModal
        open={!!pendingFolderDelete}
        folderName={pendingFolderDelete?.name ?? ''}
        cardsCount={pendingFolderDelete?.cardsCount ?? 0}
        onCancel={closeDeleteModal}
        onDeleteFolderOnly={handleDeleteFolderOnly}
        onDeleteFolderAndCards={handleDeleteFolderAndCards}
      />

      <ExportBackupModal open={exportModalOpen} profileId={profileId} onClose={() => setExportModalOpen(false)} />

      <ImportBackupModal
        open={!!pendingImportPath}
        backupPath={pendingImportPath}
        isSubmitting={isRestoringBackup}
        onCancel={handleCloseImport}
        onConfirm={handleConfirmImport}
      />

      <SettingsModal
        open={settingsModalOpen}
        settings={vault.settings}
        isSaving={isSavingSettings}
        onCancel={() => setSettingsModalOpen(false)}
        onSave={handleSaveSettings}
      />

    </div>
  );
}
