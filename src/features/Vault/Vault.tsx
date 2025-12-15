import React, { useMemo, useState } from 'react';
import { useVault } from './useVault';
import { VaultHeader } from './components/Header/VaultHeader';
import { Search } from './components/Search/Search';
import { Folders } from './components/Folders/Folders';
import { DataCards } from './components/DataCards/DataCards';
import { Details } from './components/Details/Details';
import { CreateFolderModal } from './components/modals/CreateFolderModal';
import { CreateDataCardModal } from './components/modals/CreateDataCardModal';
import { EditDataCardModal } from './components/modals/EditDataCardModal';
import { DataCard } from './types/ui';

type VaultProps = {
  profileId: string;
  profileName: string;
  onLocked: () => void;
};

export default function Vault({ profileId, profileName, onLocked }: VaultProps) {
  const vault = useVault(profileId, onLocked);
  const [isCreateFolderOpen, setCreateFolderOpen] = useState(false);
  const [isCreateCardOpen, setCreateCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<DataCard | null>(null);

  const foldersForCards = useMemo(() => vault.folders, [vault.folders]);

  return (
    <div className="vault-shell">
      <VaultHeader
        profileName={profileName}
        isTrashMode={vault.isTrashMode}
        onToggleTrash={(on) => vault.toggleTrashMode(on)}
        onLock={vault.lock}
      />

      <div className="vault-body">
        <aside className="vault-sidebar">
          <Search query={vault.searchQuery} onChange={vault.setSearchQuery} />
          <Folders
            folders={vault.folders}
            deletedFolders={vault.deletedFolders}
            isTrashMode={vault.isTrashMode}
            selectedFolderId={vault.selectedFolderId}
            onSelectFolder={vault.selectFolder}
            onAddFolder={() => setCreateFolderOpen(true)}
            onDeleteFolder={vault.deleteFolder}
            onRestoreFolder={vault.restoreFolder}
            onPurgeFolder={vault.purgeFolder}
          />
        </aside>

        <section className="vault-content">
          <DataCards
            cards={vault.visibleCards}
            isTrashMode={vault.isTrashMode}
            selectedCardId={vault.selectedCardId}
            onSelectCard={vault.selectCard}
            onAddCard={() => setCreateCardOpen(true)}
            onDeleteCard={vault.deleteCard}
            onRestoreCard={vault.restoreCard}
            onPurgeCard={vault.purgeCard}
          />
        </section>

        <section className="vault-details">
          <Details
            card={vault.selectedCard}
            folders={foldersForCards}
            onEdit={(card) => setEditingCard(card)}
            onDelete={vault.deleteCard}
          />
        </section>
      </div>

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onSubmit={(name) => vault.createFolder(name, null)}
      />

      <CreateDataCardModal
        isOpen={isCreateCardOpen}
        folders={vault.folders}
        defaultFolderId={vault.selectedFolderId}
        onClose={() => setCreateCardOpen(false)}
        onSubmit={(input) => vault.createCard(input)}
      />

      <EditDataCardModal
        isOpen={!!editingCard}
        card={editingCard}
        folders={vault.folders}
        onClose={() => setEditingCard(null)}
        onSubmit={(input) => {
          vault.updateCard(input);
          setEditingCard(null);
        }}
      />
    </div>
  );
}
