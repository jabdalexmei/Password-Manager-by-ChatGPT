import React, { useEffect } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import type { BackendUserSettings } from '../../types/backend';
import type { Folder } from '../../types/ui';
import type { FolderDialogState } from '../Folders/useFolders';
import type { VaultCategory } from '../Folders/Folders';
import { Search } from '../Search/Search';
import { Folders as VaultFolders } from '../Folders/Folders';
import { useBankCards } from '../../hooks/useBankCards';
import { useBankCardsViewModel } from './useBankCardsViewModel';
import { BankCards } from './BankCards';
import { BankCardDetails } from './BankCardDetails';

export type BankCardsCommands = {
  openCreateModal: () => void;
  setSettings: (nextSettings: BackendUserSettings) => void;
};

export type BankCardsBodyProps = {
  active: boolean;
  profileId: string;
  onLocked: () => void;
  selectedCategory: VaultCategory;
  onSelectCategory: (category: VaultCategory) => void;
  folders: Folder[];
  folderDialogs: FolderDialogState;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void | Promise<void>;
  registerCommands: (cmds: BankCardsCommands | null) => void;
};

export function BankCardsBody({
  active,
  profileId,
  onLocked,
  selectedCategory,
  onSelectCategory,
  folders,
  folderDialogs,
  onDeleteFolder,
  onRenameFolder,
  registerCommands,
}: BankCardsBodyProps) {
  const bankCards = useBankCards(profileId, onLocked);

  const viewModel = useBankCardsViewModel({
    cards: bankCards.visibleCards,
    selectedCardId: bankCards.selectedCardId,
    isTrashMode: bankCards.isTrashMode,
    onSelectCard: bankCards.selectCard,
    onCreateCard: bankCards.createCard,
    onUpdateCard: bankCards.updateCard,
    onDeleteCard: bankCards.deleteCard,
    onRestoreCard: bankCards.restoreCard,
    onPurgeCard: bankCards.purgeCard,
    onRestoreAllTrash: bankCards.restoreAllTrash,
    onPurgeAllTrash: bankCards.purgeAllTrash,
  });

  useEffect(() => {
    registerCommands({
      openCreateModal: viewModel.openCreateModal,
      setSettings: bankCards.setSettings,
    });

    return () => {
      registerCommands(null);
    };
  }, [bankCards.setSettings, registerCommands, viewModel.openCreateModal]);

  const { t: tBankCards } = useTranslation('BankCards');
  const sectionTitle = bankCards.currentSectionTitle;

  if (!active) {
    return <div hidden />;
  }

  return (
    <>
      <aside className="vault-sidebar">
        <div className="vault-sidebar-controls">
          <Search
            query={bankCards.searchQuery}
            onChange={bankCards.setSearchQuery}
          />
        </div>

        <div className="vault-sidebar-actions">
          <button className="btn btn-primary" type="button" onClick={viewModel.openCreateModal}>
            {tBankCards('label.addBankCard')}
          </button>
        </div>

        <VaultFolders
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          onAddBankCard={viewModel.openCreateModal}
          folders={folders}
          counts={bankCards.counts}
          selectedNav={bankCards.selectedNav}
          selectedFolderId={null}
          onSelectNav={bankCards.selectNav}
          dialogState={folderDialogs}
          onDeleteFolder={onDeleteFolder}
          onRenameFolder={onRenameFolder}
        />
      </aside>

      <section className="vault-datacards">
        <BankCards viewModel={viewModel} sectionTitle={sectionTitle} />
      </section>

      <section className="vault-details">
        <BankCardDetails
          card={bankCards.selectedCard}
          onEdit={(card) => viewModel.openEditModal(card)}
          onDelete={bankCards.deleteCard}
          onRestore={bankCards.restoreCard}
          onPurge={bankCards.purgeCard}
          onToggleFavorite={bankCards.toggleFavorite}
          isTrashMode={bankCards.isTrashMode}
          clipboardAutoClearEnabled={bankCards.settings?.clipboard_auto_clear_enabled}
          clipboardClearTimeoutSeconds={bankCards.settings?.clipboard_clear_timeout_seconds}
        />
      </section>
    </>
  );
}
