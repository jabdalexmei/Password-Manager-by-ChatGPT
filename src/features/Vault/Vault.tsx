import React, { useMemo } from 'react';
import { useVault } from './useVault';
import { VaultHeader } from './components/Header/VaultHeader';
import { Search } from './components/Search/Search';
import { Folders } from './components/Folders/Folders';
import { DataCards } from './components/DataCards/DataCards';
import { Details } from './components/Details/Details';
import { useDataCards } from './components/DataCards/useDataCards';
import { useFolders } from './components/Folders/useFolders';
import { useTranslation } from '../../lib/i18n';

type VaultProps = {
  profileId: string;
  profileName: string;
  onLocked: () => void;
};

export default function Vault({ profileId, profileName, onLocked }: VaultProps) {
  const vault = useVault(profileId, onLocked);
  const { t: tDataCards } = useTranslation('DataCards');
  const { t: tFolders } = useTranslation('Folders');
  const dataCardsViewModel = useDataCards({
    cards: vault.visibleCards,
    selectedCardId: vault.selectedCardId,
    isTrashMode: vault.isTrashMode,
    folders: vault.folders,
    defaultFolderId: vault.selectedFolderId,
    onSelectCard: vault.selectCard,
    onCreateCard: vault.createCard,
    onUpdateCard: vault.updateCard,
    onDeleteCard: vault.deleteCard,
    onRestoreCard: vault.restoreCard,
    onPurgeCard: vault.purgeCard,
  });
  const folderDialogs = useFolders({ onCreateFolder: (name) => vault.createFolder(name, null) });

  const foldersForCards = useMemo(() => vault.folders, [vault.folders]);

  return (
    <div className="vault-shell">
      <VaultHeader profileName={profileName} onLock={vault.lock} />

      <div className="vault-body">
        <aside className="vault-sidebar">
          <div className="vault-sidebar-actions">
            <button className="btn btn-primary" type="button" onClick={dataCardsViewModel.openCreateModal}>
              {tDataCards('label.addDataCard')}
            </button>
            <button className="btn btn-secondary" type="button" onClick={folderDialogs.openCreateFolder}>
              {tFolders('action.addFolder')}
            </button>
          </div>
          <div className="vault-sidebar-controls">
            <Search query={vault.searchQuery} onChange={vault.setSearchQuery} />
          </div>
          <Folders
            folders={vault.folders}
            deletedFolders={vault.deletedFolders}
            counts={vault.counts}
            selectedNav={vault.selectedNav}
            selectedFolderId={vault.selectedFolderId}
            onSelectNav={vault.selectNav}
            dialogState={folderDialogs}
          />
        </aside>

        <section className="vault-datacards">
          <DataCards viewModel={dataCardsViewModel} />
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

    </div>
  );
}
