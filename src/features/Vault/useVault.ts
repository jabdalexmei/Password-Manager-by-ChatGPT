import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createDataCard,
  createFolder,
  deleteDataCard,
  deleteFolder,
  getDataCard,
  getSettings,
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
import { BackendUserSettings } from './types/backend';
import { useToaster } from '../../components/Toaster';
import { useTranslation } from '../../lib/i18n';

export type SelectedNav = 'all' | 'favorites' | 'archive' | 'deleted' | { folderId: string };

export type VaultError = { code: string; message?: string } | null;

export function useVault(profileId: string, onLocked: () => void) {
  const { show: showToast } = useToaster();
  const { t: tCommon } = useTranslation('Common');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cards, setCards] = useState<DataCard[]>([]);
  const [deletedFolders, setDeletedFolders] = useState<Folder[]>([]);
  const [deletedCards, setDeletedCards] = useState<DataCard[]>([]);
  const [settings, setSettings] = useState<BackendUserSettings | null>(null);
  const [selectedNav, setSelectedNav] = useState<SelectedNav>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<VaultError>(null);

  const isTrashMode = selectedNav === 'deleted';
  const selectedFolderId = typeof selectedNav === 'object' ? selectedNav.folderId : null;

  const mapErrorMessage = useCallback(
    (code: string, fallback?: string) => {
      switch (code) {
        case 'NETWORK_ERROR':
          return tCommon('error.network', { code });
        case 'VALIDATION_ERROR':
          return fallback ?? tCommon('error.operationFailed', { code });
        default:
          return fallback ?? tCommon('error.operationFailed', { code });
      }
    },
    [tCommon]
  );

  const handleError = useCallback(
    (err: any) => {
      const code = err?.code ?? err?.error ?? 'UNKNOWN';
      const rawMessage = err?.message ?? (typeof err === 'string' ? err : '');

      if (code === 'VAULT_LOCKED') {
        onLocked();
        return;
      }

      const message = mapErrorMessage(code, rawMessage || undefined);
      showToast(message);
      setError({ code, message });
      console.error(err);
    },
    [mapErrorMessage, onLocked, showToast]
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
    getSettings()
      .then(setSettings)
      .catch(handleError);
  }, [handleError, profileId, refreshActive]);

  const selectNav = useCallback(
    async (nav: SelectedNav) => {
      setSelectedNav(nav);
      setSelectedCardId(null);

      if (nav === 'deleted' && (deletedFolders.length === 0 || deletedCards.length === 0)) {
        await refreshTrash();
      }
    },
    [deletedCards.length, deletedFolders.length, refreshTrash]
  );

  const selectCard = useCallback((id: string | null) => {
    setSelectedCardId(id);
  }, []);

  const createFolderAction = useCallback(
    async (name: string, parentId: string | null) => {
      try {
        const created = await createFolder({ name, parent_id: parentId });
        const mapped = mapFolderFromBackend(created);
        await refreshActive();
        setSelectedNav((prev) => (prev === 'deleted' ? { folderId: mapped.id } : prev));
        return mapped;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [handleError, refreshActive]
  );

  const renameFolderAction = useCallback(
    async (id: string, name: string) => {
      try {
        await renameFolder({ id, name });
        await refreshActive();
        setSelectedNav((prev) => {
          if (typeof prev === 'object' && prev.folderId === id) {
            return { folderId: id };
          }
          return prev;
        });
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, refreshActive]
  );

  const deleteFolderAction = useCallback(
    async (id: string) => {
      try {
        await deleteFolder(id);
        await refreshActive();
        setSelectedNav((prev) => {
          if (typeof prev === 'object' && prev.folderId === id) return 'all';
          return prev;
        });
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
        const created = await createDataCard(mapCreateCardToBackend(input));
        const mapped = mapCardFromBackend(created);
        await refreshActive();
        setSelectedNav((prev) => (prev === 'deleted' ? 'all' : prev));
        setSelectedCardId(mapped.id);
        return mapped;
      } catch (err) {
        handleError(err);
        return null;
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
      const code = (err as any)?.code ?? 'UNKNOWN';
      const message = mapErrorMessage(code, (err as any)?.message ?? undefined);
      showToast(message);
      console.error(err);
    }
    setFolders([]);
    setCards([]);
    setDeletedCards([]);
    setDeletedFolders([]);
    setSelectedCardId(null);
    setSelectedNav('all');
    onLocked();
    }, [mapErrorMessage, onLocked, showToast]);

  const visibleCards = useMemo(() => {
    const activeCards = cards.filter((card) => !card.deletedAt);
    const isArchived = (card: DataCard) => card.tags?.includes('archived');
    let pool: DataCard[];

    if (selectedNav === 'all') {
      pool = activeCards.filter((card) => !isArchived(card));
    } else if (selectedNav === 'favorites') {
      pool = activeCards.filter((card) => card.tags?.includes('favorite') && !isArchived(card));
    } else if (selectedNav === 'archive') {
      pool = activeCards.filter((card) => isArchived(card));
    } else if (selectedNav === 'deleted') {
      pool = deletedCards;
    } else {
      pool = activeCards.filter((card) => card.folderId === selectedNav.folderId && !isArchived(card));
    }

    if (!searchQuery.trim()) return pool;

    const query = searchQuery.toLowerCase();
    return pool.filter((card) => {
      const fields = [card.title, card.username, card.email, card.url, ...(card.tags || [])];
      return fields.some((field) => field && field.toLowerCase().includes(query));
    });
  }, [cards, deletedCards, searchQuery, selectedNav]);

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

  const toggleFavorite = useCallback(
    async (id: string) => {
      const current = cards.find((card) => card.id === id);
      if (!current) return;

      const tagSet = new Set(current.tags || []);
      if (tagSet.has('favorite')) {
        tagSet.delete('favorite');
      } else {
        tagSet.add('favorite');
      }

      await updateCardAction({
        id: current.id,
        folderId: current.folderId,
        title: current.title,
        url: current.url,
        email: current.email,
        username: current.username,
        mobilePhone: current.mobilePhone,
        note: current.note,
        tags: Array.from(tagSet),
        password: current.password,
      });
    },
    [cards, updateCardAction]
  );

  const counts = useMemo(
    () => {
      const activeCards = cards.filter((card) => !card.deletedAt);
      const isArchived = (card: DataCard) => card.tags?.includes('archived');

      return {
        all: activeCards.filter((card) => !isArchived(card)).length,
        favorites: activeCards.filter((card) => card.tags?.includes('favorite') && !isArchived(card)).length,
        archive: activeCards.filter((card) => isArchived(card)).length,
        deleted: deletedCards.length,
        folders: activeCards.reduce<Record<string, number>>((acc, card) => {
          if (card.folderId && !isArchived(card)) {
            acc[card.folderId] = (acc[card.folderId] || 0) + 1;
          }
          return acc;
        }, {}),
      };
    },
    [cards, deletedCards]
  );

  return {
    folders,
    cards,
    deletedFolders,
    deletedCards,
    selectedNav,
    selectedCardId,
    selectedCard,
    isTrashMode,
    counts,
    selectedFolderId,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    visibleCards,
    refreshActive,
    refreshTrash,
    selectNav,
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
    toggleFavorite,
    settings,
  };
}
