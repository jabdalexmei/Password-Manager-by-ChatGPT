import React, { useMemo, useState } from 'react';
import { useVault } from './useVault';
import { VaultHeader } from './components/Header/VaultHeader';
import { Search } from './components/Search/Search';
import { Folders } from './components/Folders/Folders';
import { DataCards } from './components/DataCards/DataCards';
import { Details } from './components/Details/Details';
import { useDataCards } from './components/DataCards/useDataCards';
import { useFolders } from './components/Folders/useFolders';
import { useTranslation } from '../../lib/i18n';
import { DeleteFolderModal } from './components/modals/DeleteFolderModal';

type VaultProps = {
  profileId: string;
  profileName: string;
  onLocked: () => void;
};

export default function Vault({ profileId, profileName, onLocked }: VaultProps) {
  const vault = useVault(profileId, onLocked);
  const { t: tDataCards } = useTranslation('DataCards');
  const { t: tFolders } = useTranslation('Folders');
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

  const foldersForCards = useMemo(() => vault.folders, [vault.folders]);

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
      <VaultHeader profileName={profileName} profileId={profileId} onLock={vault.lock} />

      <div className="vault-body">
        <aside className="vault-sidebar">
          <div className="vault-sidebar-controls">
            <Search query={vault.searchQuery} onChange={vault.setSearchQuery} />
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
          <DataCards viewModel={dataCardsViewModel} sectionTitle={vault.currentSectionTitle} />
        </section>

        <section className="vault-details">
          <Details
            card={vault.selectedCard}
            folders={foldersForCards}
            onEdit={(card) => dataCardsViewModel.openEditModal(card)}
            onDelete={vault.deleteCard}
            onRestore={vault.restoreCard}
            onPurge={vault.purgeCard}
            onToggleFavorite={vault.toggleFavorite}
            isTrashMode={vault.isTrashMode}
            clipboardClearTimeoutSeconds={vault.settings?.clipboard_clear_timeout_seconds}
          />
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

    </div>
  );
}
