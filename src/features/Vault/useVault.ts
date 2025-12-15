import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createDataCard,
  createFolder,
  deleteDataCard,
  deleteFolder,
  getDataCard,
  listDataCards,
  listDeletedDataCards,
  listDeletedFolders,
  listFolders,
  moveDataCardToFolder,
  purgeDataCard,
  purgeFolder,
  renameFolder,
  restoreDataCard,
  restoreFolder,
  updateDataCard,
} from './api/vaultApi';
import { lockVault } from '../../lib/tauri';
import {
  mapCardFromBackend,
  mapCreateCardToBackend,
  mapFolderFromBackend,
  mapUpdateCardToBackend,
} from './types/mappers';
import { CreateDataCardInput, DataCard, Folder, UpdateDataCardInput } from './types/ui';

export type VaultError = { code: string; message?: string } | null;

export function useVault(profileId: string, onLocked: () => void) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cards, setCards] = useState<DataCard[]>([]);
  const [deletedFolders, setDeletedFolders] = useState<Folder[]>([]);
  const [deletedCards, setDeletedCards] = useState<DataCard[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTrashMode, setIsTrashMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<VaultError>(null);

  const handleError = useCallback(
    (err: any) => {
      const code = err?.code ?? err?.error ?? 'UNKNOWN';
      const message = err?.message ?? String(err);

      if (code === 'VAULT_LOCKED') {
        onLocked();
        return;
      }

      setError({ code, message });
      console.error(err);
    },
    [onLocked]
  );

  const refreshActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedFolders, fetchedCards] = await Promise.all([listFolders(), listDataCards()]);
      setFolders(fetchedFolders.map(mapFolderFromBackend));
      setCards(fetchedCards.map(mapCardFromBackend));
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const refreshTrash = useCallback(async () => {
    try {
      const [trashFolders, trashCards] = await Promise.all([listDeletedFolders(), listDeletedDataCards()]);
      setDeletedFolders(trashFolders.map(mapFolderFromBackend));
      setDeletedCards(trashCards.map(mapCardFromBackend));
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    refreshActive();
  }, [refreshActive, profileId]);

  const toggleTrashMode = useCallback(
    async (on: boolean) => {
      setIsTrashMode(on);
      if (on && (deletedFolders.length === 0 || deletedCards.length === 0)) {
        await refreshTrash();
      }
      setSelectedCardId(null);
    },
    [deletedCards.length, deletedFolders.length, refreshTrash]
  );

  const selectFolder = useCallback((id: string | null) => {
    setSelectedFolderId(id);
    setSelectedCardId(null);
  }, []);

  const selectCard = useCallback((id: string | null) => {
    setSelectedCardId(id);
  }, []);

  const createFolderAction = useCallback(
    async (name: string, parentId: string | null) => {
      try {
        await createFolder({ name, parent_id: parentId });
        await refreshActive();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive]
  );

  const renameFolderAction = useCallback(
    async (id: string, name: string) => {
      try {
        await renameFolder({ id, name });
        await refreshActive();
        if (isTrashMode) await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, isTrashMode, refreshActive, refreshTrash]
  );

  const deleteFolderAction = useCallback(
    async (id: string) => {
      try {
        await deleteFolder(id);
        await refreshActive();
        if (isTrashMode) await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, isTrashMode, refreshActive, refreshTrash]
  );

  const restoreFolderAction = useCallback(
    async (id: string) => {
      try {
        await restoreFolder(id);
        await refreshActive();
        await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive, refreshTrash]
  );

  const purgeFolderAction = useCallback(
    async (id: string) => {
      try {
        await purgeFolder(id);
        await refreshActive();
        await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive, refreshTrash]
  );

  const createCardAction = useCallback(
    async (input: CreateDataCardInput) => {
      try {
        await createDataCard(mapCreateCardToBackend(input));
        await refreshActive();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive]
  );

  const updateCardAction = useCallback(
    async (input: UpdateDataCardInput) => {
      try {
        await updateDataCard(mapUpdateCardToBackend(input));
        await refreshActive();
        if (isTrashMode) await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, isTrashMode, refreshActive, refreshTrash]
  );

  const deleteCardAction = useCallback(
    async (id: string) => {
      try {
        await deleteDataCard(id);
        await refreshActive();
        if (isTrashMode) await refreshTrash();
        setSelectedCardId((prev) => (prev === id ? null : prev));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, isTrashMode, refreshActive, refreshTrash]
  );

  const restoreCardAction = useCallback(
    async (id: string) => {
      try {
        await restoreDataCard(id);
        await refreshActive();
        await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive, refreshTrash]
  );

  const purgeCardAction = useCallback(
    async (id: string) => {
      try {
        await purgeDataCard(id);
        await refreshActive();
        await refreshTrash();
        setSelectedCardId((prev) => (prev === id ? null : prev));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive, refreshTrash]
  );

  const moveCardAction = useCallback(
    async (id: string, folderId: string | null) => {
      try {
        await moveDataCardToFolder({ id, folder_id: folderId });
        await refreshActive();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive]
  );

  const lock = useCallback(async () => {
    try {
      await lockVault();
    } catch (err) {
      console.error(err);
    }
    setFolders([]);
    setCards([]);
    setDeletedCards([]);
    setDeletedFolders([]);
    setSelectedCardId(null);
    setSelectedFolderId(null);
    onLocked();
  }, [onLocked]);

  const visibleCards = useMemo(() => {
    const list = isTrashMode ? deletedCards : cards;
    const folderFiltered = selectedFolderId ? list.filter((c) => c.folderId === selectedFolderId) : list;
    if (!searchQuery.trim()) return folderFiltered;

    const query = searchQuery.toLowerCase();
    return folderFiltered.filter((card) => {
      const fields = [card.title, card.username, card.email, card.url, ...(card.tags || [])];
      return fields.some((field) => field && field.toLowerCase().includes(query));
    });
  }, [cards, deletedCards, isTrashMode, searchQuery, selectedFolderId]);

  const selectedCard = useMemo(() => {
    const pool = isTrashMode ? deletedCards : cards;
    return pool.find((card) => card.id === selectedCardId) ?? null;
  }, [cards, deletedCards, isTrashMode, selectedCardId]);

  const loadCard = useCallback(
    async (id: string) => {
      try {
        const card = await getDataCard(id);
        const mapped = mapCardFromBackend(card);
        if (mapped.deletedAt) {
          setDeletedCards((prev) => {
            const filtered = prev.filter((c) => c.id !== mapped.id);
            return [...filtered, mapped];
          });
        } else {
          setCards((prev) => {
            const filtered = prev.filter((c) => c.id !== mapped.id);
            return [...filtered, mapped];
          });
        }
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  return {
    folders,
    cards,
    deletedFolders,
    deletedCards,
    selectedFolderId,
    selectedCardId,
    selectedCard,
    searchQuery,
    setSearchQuery,
    isTrashMode,
    loading,
    error,
    visibleCards,
    refreshActive,
    refreshTrash,
    toggleTrashMode,
    selectFolder,
    selectCard,
    createFolder: createFolderAction,
    renameFolder: renameFolderAction,
    deleteFolder: deleteFolderAction,
    restoreFolder: restoreFolderAction,
    purgeFolder: purgeFolderAction,
    createCard: createCardAction,
    updateCard: updateCardAction,
    deleteCard: deleteCardAction,
    restoreCard: restoreCardAction,
    purgeCard: purgeCardAction,
    moveCardToFolder: moveCardAction,
    lock,
    loadCard,
  };
}
