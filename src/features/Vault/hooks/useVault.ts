import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDataCard,
  createFolder,
  addAttachmentFromPath,
  deleteDataCard,
  deleteFolderAndCards,
  deleteFolderOnly,
  getDataCard,
  getSettings,
  updateSettings,
  listDataCardSummaries,
  listDeletedDataCardSummaries,
  listFolders,
  moveDataCardToFolder,
  purgeDataCard,
  renameFolder,
  restoreDataCard,
  setDataCardFavorite,
  updateDataCard,
} from '../api/vaultApi';
import { clipboardClearAll, lockVault } from '../../../shared/lib/tauri';
import {
  mapCardFromBackend,
  mapCardSummaryFromBackend,
  mapCardToSummary,
  mapCreateCardToBackend,
  mapFolderFromBackend,
  mapUpdateCardToBackend,
} from '../types/mappers';
import { CreateDataCardInput, DataCard, DataCardSummary, Folder, UpdateDataCardInput } from '../types/ui';
import { BackendUserSettings } from '../types/backend';
import { defaultVaultSearchFilters, VaultSearchFilters } from '../types/searchFilters';
import { useToaster } from '../../../shared/components/Toaster';
import { useTranslation } from '../../../shared/lib/i18n';
import { useDebouncedValue } from './useDebouncedValue';
import { sortCards, sortFolders } from '../types/sort';

export type SelectedNav = 'all' | 'favorites' | 'archive' | 'deleted' | { folderId: string };

export type VaultError = { code: string; message?: string } | null;

export function useVault(profileId: string, onLocked: () => void) {
  const { show: showToast } = useToaster();
  const { t: tCommon } = useTranslation('Common');
  const { t: tVault } = useTranslation('Vault');
  const initOnceRef = useRef(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cards, setCards] = useState<DataCardSummary[]>([]);
  const [cardDetailsById, setCardDetailsById] = useState<Record<string, DataCard>>({});
  const [deletedCards, setDeletedCards] = useState<DataCardSummary[]>([]);
  const [settings, setSettings] = useState<BackendUserSettings | null>(null);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const [selectedNav, setSelectedNav] = useState<SelectedNav>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchFilters, setSearchFilters] = useState<VaultSearchFilters>(defaultVaultSearchFilters);
  const debouncedSearchQuery = useDebouncedValue(searchInput, 200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<VaultError>(null);
  const dtf = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    []
  );

  useEffect(() => {
    initOnceRef.current = false;
    setFolders([]);
    setCards([]);
    setCardDetailsById({});
    setDeletedCards([]);
    setSelectedNav('all');
    setSelectedCardId(null);
    setTrashLoaded(false);
  }, [profileId]);

  const isTrashMode = selectedNav === 'deleted';
  const selectedFolderId = typeof selectedNav === 'object' ? selectedNav.folderId : null;

  const mapErrorMessage = useCallback(
    (code: string, fallback?: string) => {
      switch (code) {
        case 'NETWORK_ERROR':
          return tCommon('error.network', { code });
        case 'BACKUP_PROFILE_MISMATCH':
          return tCommon('error.backupProfileMismatch', { code });
        case 'BACKUP_UNSUPPORTED_FORMAT':
          return tCommon('error.backupUnsupportedFormat', { code });
        case 'VALIDATION_ERROR':
          return fallback ?? tCommon('error.operationFailed', { code });
        default:
          return fallback ?? tCommon('error.operationFailed', { code });
      }
    },
    [tCommon]
  );

  const sortCardsWithSettings = useCallback(
    (list: DataCardSummary[]) => {
      const field = settings?.default_sort_field ?? 'updated_at';
      const direction = settings?.default_sort_direction ?? 'DESC';
      return [...list].sort((a, b) => sortCards(a, b, field, direction));
    },
    [settings]
  );

  useEffect(() => {
    setCards((prev) => sortCardsWithSettings(prev));
    setDeletedCards((prev) => sortCardsWithSettings(prev));
  }, [sortCardsWithSettings]);

  const handleError = useCallback(
    (err: any) => {
      const code = err?.code ?? err?.error ?? 'UNKNOWN';
      const rawMessage = err?.message ?? (typeof err === 'string' ? err : '');

      if (code === 'VAULT_LOCKED') {
        onLocked();
        return;
      }

      const message = mapErrorMessage(code, rawMessage || undefined);
      showToast(message, 'error');
      setError({ code, message });
      console.error(err);
    },
    [mapErrorMessage, onLocked, showToast]
  );

  const refreshActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedFolders, fetchedCards] = await Promise.all([listFolders(), listDataCardSummaries()]);
      setFolders(fetchedFolders.map(mapFolderFromBackend).sort(sortFolders));
      setCards(sortCardsWithSettings(fetchedCards.map((card) => mapCardSummaryFromBackend(card, dtf))));
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [dtf, handleError, sortCardsWithSettings]);

  const refreshTrash = useCallback(async () => {
    try {
      const trashCards = await listDeletedDataCardSummaries();
      setDeletedCards(sortCardsWithSettings(trashCards.map((card) => mapCardSummaryFromBackend(card, dtf))));
      setTrashLoaded(true);
    } catch (err) {
      handleError(err);
      setTrashLoaded(false);
    }
  }, [dtf, handleError, sortCardsWithSettings]);

  const updateSettingsAction = useCallback(
    async (nextSettings: BackendUserSettings) => {
      try {
        await updateSettings(nextSettings);
        setSettings(nextSettings);
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [handleError]
  );

  const loadCard = useCallback(
    async (id: string) => {
      try {
        const card = await getDataCard(id);
        const mapped = mapCardFromBackend(card);
        const prevSummary = cards.find((c) => c.id === id) || deletedCards.find((c) => c.id === id) || null;
        const summary = { ...mapCardToSummary(mapped, dtf), hasAttachments: prevSummary?.hasAttachments ?? false };

        setCardDetailsById((prev) => ({ ...prev, [id]: mapped }));

        if (mapped.deletedAt) {
          setDeletedCards((prev) => {
            const filtered = prev.filter((c) => c.id !== id);
            return sortCardsWithSettings([...filtered, { ...summary, deletedAt: mapped.deletedAt }]);
          });
          setCards((prev) => prev.filter((c) => c.id !== id));
        } else {
          setCards((prev) => {
            const filtered = prev.filter((c) => c.id !== id);
            return sortCardsWithSettings([...filtered, summary]);
          });
          setDeletedCards((prev) => prev.filter((c) => c.id !== id));
        }
      } catch (err) {
        handleError(err);
      }
    },
    [cards, deletedCards, dtf, handleError, sortCardsWithSettings]
  );

  useEffect(() => {
    if (initOnceRef.current) return;
    initOnceRef.current = true;

    refreshActive();
    getSettings()
      .then(setSettings)
      .catch(handleError);
  }, [handleError, refreshActive]);

  const selectNav = useCallback(
    async (nav: SelectedNav) => {
      setSelectedNav(nav);
      setSelectedCardId(null);

      if (nav === 'deleted' && !trashLoaded) {
        await refreshTrash();
      }
    },
    [refreshTrash, trashLoaded]
  );

  const selectCard = useCallback(
    (id: string | null) => {
      setSelectedCardId(id);
      if (id && !cardDetailsById[id]) {
        loadCard(id);
      }
    },
    [cardDetailsById, loadCard]
  );

  const createFolderAction = useCallback(
    async (name: string, parentId: string | null) => {
      try {
        const created = await createFolder({ name, parent_id: parentId });
        const mapped = mapFolderFromBackend(created);
        setFolders((prev) => [...prev, mapped].sort(sortFolders));
        setSelectedNav({ folderId: mapped.id });
        return mapped;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [handleError, sortCardsWithSettings]
  );

  const renameFolderAction = useCallback(
    async (id: string, name: string) => {
      try {
        await renameFolder({ id, name });
        setFolders((prev) =>
          [...prev.map((folder) => (folder.id === id ? { ...folder, name } : folder))].sort(sortFolders)
        );
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
    [handleError]
  );

  const deleteFolderOnlyAction = useCallback(
    async (id: string) => {
      try {
        await deleteFolderOnly(id);
        setFolders((prev) => prev.filter((folder) => folder.id !== id).sort(sortFolders));
        setCards((prev) =>
          prev.map((card) => (card.folderId === id ? { ...card, folderId: null } : card))
        );
        setCardDetailsById((prev) => {
          const next = { ...prev };
          Object.entries(next).forEach(([cardId, card]) => {
            if (card.folderId === id) {
              next[cardId] = { ...card, folderId: null };
            }
          });
          return next;
        });
        setSelectedNav((prev) => (typeof prev === 'object' && prev.folderId === id ? 'all' : prev));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const deleteFolderAndCardsAction = useCallback(
    async (id: string) => {
      try {
        await deleteFolderAndCards(id);
        const softDeleteEnabled = settings?.soft_delete_enabled ?? true;

        setFolders((prev) => prev.filter((folder) => folder.id !== id).sort(sortFolders));
        setCards((prev) => prev.filter((card) => card.folderId !== id));
        setCardDetailsById((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((cardId) => {
            if (next[cardId].folderId === id) {
              delete next[cardId];
            }
          });
          return next;
        });
        setSelectedCardId((prev) => {
          if (!prev) return prev;
          const selected = cardDetailsById[prev] ?? cards.find((card) => card.id === prev);
          if (selected?.folderId === id) {
            return null;
          }
          return prev;
        });
        setSelectedNav((prev) => (typeof prev === 'object' && prev.folderId === id ? 'all' : prev));

        if (softDeleteEnabled && trashLoaded) {
          await refreshTrash();
        }
      } catch (err) {
        handleError(err);
      }
    },
    [cardDetailsById, cards, handleError, refreshTrash, settings, trashLoaded]
  );

  const createCardAction = useCallback(
    async (input: CreateDataCardInput) => {
      try {
        const created = await createDataCard(mapCreateCardToBackend(input));
        const mapped = mapCardFromBackend(created);
        const summary = mapCardToSummary(mapped, dtf);

        setCards((prev) => sortCardsWithSettings([summary, ...prev]));
        setCardDetailsById((prev) => ({ ...prev, [mapped.id]: mapped }));
        setSelectedNav((prev) => (prev === 'deleted' ? 'all' : prev));
        setSelectedCardId(mapped.id);
        return mapped;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [dtf, handleError, sortCardsWithSettings]
  );

  const uploadAttachments = useCallback(
    async (cardId: string, paths: string[]) => {
      const failed: string[] = [];
      for (const path of paths) {
        try {
          await addAttachmentFromPath(cardId, path);
          setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, hasAttachments: true } : card)));
        } catch (err) {
          failed.push(path);
          handleError(err);
        }
      }

      return failed;
    },
    [handleError]
  );

  const updateCardAction = useCallback(
    async (input: UpdateDataCardInput) => {
      try {
        await updateDataCard(mapUpdateCardToBackend(input));
        await loadCard(input.id);
        if (isTrashMode) await refreshTrash();
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, isTrashMode, loadCard, refreshTrash]
  );

  const deleteCardAction = useCallback(
    async (id: string) => {
      try {
        await deleteDataCard(id);
        const softDeleteEnabled = settings?.soft_delete_enabled ?? true;
        const cachedSummary = cardDetailsById[id]
          ? mapCardToSummary(cardDetailsById[id], dtf)
          : cards.find((card) => card.id === id) || deletedCards.find((card) => card.id === id);

        setCards((prev) => prev.filter((card) => card.id !== id));
        setSelectedCardId((prev) => (prev === id ? null : prev));

        if (softDeleteEnabled) {
          const deletedAt = new Date().toISOString();
          if (trashLoaded && cachedSummary) {
            setDeletedCards((prev) => {
              const filtered = prev.filter((card) => card.id !== id);
              return sortCardsWithSettings([...filtered, { ...cachedSummary, deletedAt }]);
            });
          }
        } else {
          setCardDetailsById((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      } catch (err) {
        handleError(err);
      }
    },
    [cardDetailsById, cards, deletedCards, dtf, handleError, settings, sortCardsWithSettings, trashLoaded]
  );

  const restoreCardAction = useCallback(
    async (id: string) => {
      try {
        await restoreDataCard(id);
        setDeletedCards((prev) => prev.filter((card) => card.id !== id));
        setCards((prev) => {
          const restored = deletedCards.find((card) => card.id === id);
          if (!restored) return prev;
          const updated = { ...restored, deletedAt: null };
          return sortCardsWithSettings([...prev.filter((card) => card.id !== id), updated]);
        });
        setSelectedNav((nav) => (nav === 'deleted' ? 'all' : nav));
        setSelectedCardId(id);
        await loadCard(id);
      } catch (err) {
        handleError(err);
      }
    },
    [deletedCards, handleError, loadCard, sortCardsWithSettings]
  );

  const purgeCardAction = useCallback(
    async (id: string) => {
      try {
        await purgeDataCard(id);
        setDeletedCards((prev) => prev.filter((card) => card.id !== id));
        setCardDetailsById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSelectedCardId((prev) => (prev === id ? null : prev));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const moveCardAction = useCallback(
    async (id: string, folderId: string | null) => {
      try {
        await moveDataCardToFolder({ id, folder_id: folderId });
        setCards((prev) =>
          sortCardsWithSettings(prev.map((card) => (card.id === id ? { ...card, folderId } : card)))
        );
        setCardDetailsById((prev) =>
          prev[id] ? { ...prev, [id]: { ...prev[id], folderId } } : prev
        );
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const lock = useCallback(async () => {
    let shouldNavigate = false;
    try {
      try {
        await lockVault();
        shouldNavigate = true;
      } catch (err) {
        const code = (err as any)?.code ?? 'UNKNOWN';
        if (code === 'VAULT_LOCKED') {
          shouldNavigate = true;
        } else {
          throw err;
        }
      }
    } catch (err) {
      const code = (err as any)?.code ?? 'UNKNOWN';
      const message = mapErrorMessage(code, (err as any)?.message ?? undefined);
      showToast(message, 'error');
      console.error(err);
      return;
    } finally {
      try {
        await clipboardClearAll();
      } catch (err) {
        console.error(err);
      }
    }
    if (!shouldNavigate) {
      return;
    }
    setFolders([]);
    setCards([]);
    setDeletedCards([]);
    setTrashLoaded(false);
    setSelectedCardId(null);
    setSelectedNav('all');
    onLocked();
  }, [mapErrorMessage, onLocked, showToast]);

  useEffect(() => {
    if (!settings?.auto_lock_enabled) return;

    const timeoutSec = Number(settings.auto_lock_timeout);
    if (!Number.isFinite(timeoutSec) || timeoutSec < 30 || timeoutSec > 86400) return;

    let timerId: number | null = null;

    const schedule = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        void lock();
      }, timeoutSec * 1000);
    };

    const onActivity = () => {
      schedule();
    };

    schedule();

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('focus', onActivity);

    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('focus', onActivity);
    };
  }, [settings?.auto_lock_enabled, settings?.auto_lock_timeout, lock]);

  const visibleCards = useMemo(() => {
    const activeCards = cards.filter((card) => !card.deletedAt);
    const isArchived = (card: DataCardSummary) => card.tags?.includes('archived');
    let pool: DataCardSummary[];

    if (selectedNav === 'all') {
      pool = activeCards.filter((card) => !isArchived(card));
    } else if (selectedNav === 'favorites') {
      pool = activeCards.filter((card) => card.isFavorite && !isArchived(card));
    } else if (selectedNav === 'archive') {
      pool = activeCards.filter((card) => isArchived(card));
    } else if (selectedNav === 'deleted') {
      pool = deletedCards;
    } else {
      pool = activeCards.filter((card) => card.folderId === selectedNav.folderId && !isArchived(card));
    }

    if (searchFilters.has2fa) pool = pool.filter((card) => card.hasTotp);
    if (searchFilters.hasAttachments) pool = pool.filter((card) => card.hasAttachments);
    if (searchFilters.hasSeedPhrase) pool = pool.filter((card) => card.hasSeedPhrase);
    if (searchFilters.hasPhone) pool = pool.filter((card) => card.hasPhone);
    if (searchFilters.hasNotes) pool = pool.filter((card) => card.hasNote);

    if (!debouncedSearchQuery.trim()) return pool;

    const query = debouncedSearchQuery.toLowerCase();
    return pool.filter((card) => {
      const fields = [card.title, card.username, card.email, card.url, card.metaLine, ...(card.tags || [])];
      return fields.some((field) => field && field.toLowerCase().includes(query));
    });
  }, [cards, debouncedSearchQuery, deletedCards, searchFilters, selectedNav]);

  const selectedCard = useMemo(() => {
    if (selectedCardId && cardDetailsById[selectedCardId]) {
      return cardDetailsById[selectedCardId];
    }
    const pool = isTrashMode ? deletedCards : cards;
    return pool.find((card) => card.id === selectedCardId) ?? null;
  }, [cardDetailsById, cards, deletedCards, isTrashMode, selectedCardId]);

  const currentSectionTitle = useMemo(() => {
    if (selectedFolderId) {
      const folder = folders.find((item) => item.id === selectedFolderId);
      if (folder) return folder.name;
    }

    switch (selectedNav) {
      case 'favorites':
        return tVault('nav.favorites');
      case 'archive':
        return tVault('nav.archive');
      case 'deleted':
        return tVault('nav.deleted');
      case 'all':
      default:
        return tVault('nav.all_items');
    }
  }, [folders, selectedFolderId, selectedNav, tVault]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const current = cards.find((card) => card.id === id);
      if (!current) return;

      const nextFavorite = !current.isFavorite;

      try {
        await setDataCardFavorite({ id: current.id, is_favorite: nextFavorite });

        setCards((prev) =>
          prev.map((card) => (card.id === current.id ? { ...card, isFavorite: nextFavorite } : card))
        );
        setCardDetailsById((prev) =>
          prev[current.id]
            ? { ...prev, [current.id]: { ...prev[current.id], isFavorite: nextFavorite } }
            : prev
        );
      } catch (err) {
        handleError(err);
      }
    },
    [cards, handleError]
  );

  const counts = useMemo(
    () => {
      const activeCards = cards.filter((card) => !card.deletedAt);
      const isArchived = (card: DataCardSummary) => card.tags?.includes('archived');

      return {
        all: activeCards.filter((card) => !isArchived(card)).length,
        favorites: activeCards.filter((card) => card.isFavorite && !isArchived(card)).length,
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
    deletedCards,
    selectedNav,
    selectedCardId,
    selectedCard,
    isTrashMode,
    counts,
    selectedFolderId,
    currentSectionTitle,
    searchQuery: searchInput,
    setSearchQuery: setSearchInput,
    searchFilters,
    setSearchFilters,
    loading,
    error,
    visibleCards,
    refreshActive,
    refreshTrash,
    selectNav,
    selectCard,
    createFolder: createFolderAction,
    renameFolder: renameFolderAction,
    deleteFolderOnly: deleteFolderOnlyAction,
    deleteFolderAndCards: deleteFolderAndCardsAction,
    createCard: createCardAction,
    uploadAttachments,
    updateCard: updateCardAction,
    deleteCard: deleteCardAction,
    restoreCard: restoreCardAction,
    purgeCard: purgeCardAction,
    moveCardToFolder: moveCardAction,
    lock,
    loadCard,
    toggleFavorite,
    settings,
    updateSettings: updateSettingsAction,
  };
}
