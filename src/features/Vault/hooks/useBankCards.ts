import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBankCard,
  deleteBankCard,
  getBankCard,
  getSettings,
  updateSettings,
  listBankCardSummaries,
  listDeletedBankCardSummaries,
  purgeBankCard,
  purgeAllDeletedBankCards,
  restoreBankCard,
  restoreAllDeletedBankCards,
  setBankCardFavorite,
  updateBankCard,
} from '../api/vaultApi';
import { useDebouncedValue } from './useDebouncedValue';
import { useTranslation } from '../../../shared/lib/i18n';
import { useToaster } from '../../../shared/components/Toaster';
import {
  mapBankCardFromBackend,
  mapBankCardSummaryFromBackend,
  mapBankCardToSummary,
  mapCreateBankCardToBackend,
  mapUpdateBankCardToBackend,
} from '../types/mappers';
import { BankCardItem, BankCardSummary, CreateBankCardInput, UpdateBankCardInput } from '../types/ui';
import { sortCards } from '../types/sort';
import { SelectedNav } from './useVault';
import { BackendUserSettings } from '../types/backend';

export type BankCardsError = { code: string; message?: string } | null;

export function useBankCards(profileId: string, onLocked: () => void) {
  const { show: showToast } = useToaster();
  const { t: tCommon } = useTranslation('Common');
  const { t: tVault } = useTranslation('Vault');
  const initOnceRef = useRef(false);
  const [cards, setCards] = useState<BankCardSummary[]>([]);
  const [cardDetailsById, setCardDetailsById] = useState<Record<string, BankCardItem>>({});
  const [deletedCards, setDeletedCards] = useState<BankCardSummary[]>([]);
  const [settings, setSettings] = useState<BackendUserSettings | null>(null);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const [selectedNav, setSelectedNav] = useState<SelectedNav>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchInput, 200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BankCardsError>(null);
  const dtf = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    []
  );

  useEffect(() => {
    initOnceRef.current = false;
    setCards([]);
    setCardDetailsById({});
    setDeletedCards([]);
    setSelectedNav('all');
    setSelectedCardId(null);
    setTrashLoaded(false);
  }, [profileId]);

  const isTrashMode = selectedNav === 'deleted';

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

  const sortCardsWithSettings = useCallback(
    (list: BankCardSummary[]) => {
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
      const fetchedCards = await listBankCardSummaries();
      setCards(sortCardsWithSettings(fetchedCards.map((card) => mapBankCardSummaryFromBackend(card, dtf))));
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [dtf, handleError, sortCardsWithSettings]);

  const refreshTrash = useCallback(async () => {
    try {
      const trashCards = await listDeletedBankCardSummaries();
      setDeletedCards(sortCardsWithSettings(trashCards.map((card) => mapBankCardSummaryFromBackend(card, dtf))));
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

  const setSettingsState = useCallback((nextSettings: BackendUserSettings | null) => {
    setSettings(nextSettings);
  }, []);

  const loadCard = useCallback(
    async (id: string) => {
      try {
        const card = await getBankCard(id);
        const mapped = mapBankCardFromBackend(card);
        const summary = mapBankCardToSummary(mapped, dtf);

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
    [dtf, handleError, sortCardsWithSettings]
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

  const createCardAction = useCallback(
    async (input: CreateBankCardInput) => {
      try {
        const created = await createBankCard(mapCreateBankCardToBackend(input));
        const mapped = mapBankCardFromBackend(created);
        const summary = mapBankCardToSummary(mapped, dtf);

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

  const updateCardAction = useCallback(
    async (input: UpdateBankCardInput) => {
      try {
        await updateBankCard(mapUpdateBankCardToBackend(input));
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
        await deleteBankCard(id);
        const softDeleteEnabled = settings?.soft_delete_enabled ?? true;
        const cachedSummary = cardDetailsById[id]
          ? mapBankCardToSummary(cardDetailsById[id], dtf)
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
        await restoreBankCard(id);
        setDeletedCards((prev) => prev.filter((card) => card.id !== id));
        setCards((prev) => {
          const restored = deletedCards.find((card) => card.id === id);
          if (!restored) return prev;
          const updated = { ...restored, deletedAt: null };
          return sortCardsWithSettings([...prev.filter((card) => card.id !== id), updated]);
        });
        setSelectedCardId((prev) => (prev === id ? null : prev));
      } catch (err) {
        handleError(err);
      }
    },
    [deletedCards, handleError, sortCardsWithSettings]
  );

  const purgeCardAction = useCallback(
    async (id: string) => {
      try {
        await purgeBankCard(id);
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

  const restoreAllTrashAction = useCallback(async () => {
    if (deletedCards.length === 0) return;
    try {
      await restoreAllDeletedBankCards();
      setDeletedCards([]);
      setCards((prev) =>
        sortCardsWithSettings([
          ...prev,
          ...deletedCards.map((card) => ({ ...card, deletedAt: null })),
        ])
      );
      setSelectedNav((nav) => (nav === 'deleted' ? 'all' : nav));
    } catch (err) {
      handleError(err);
    }
  }, [deletedCards, handleError, sortCardsWithSettings]);

  const purgeAllTrashAction = useCallback(async () => {
    if (deletedCards.length === 0) return;
    try {
      await purgeAllDeletedBankCards();
      setDeletedCards([]);
      setCardDetailsById((prev) => {
        const next = { ...prev };
        for (const card of deletedCards) {
          delete next[card.id];
        }
        return next;
      });
      setSelectedCardId((prev) =>
        prev && deletedCards.some((card) => card.id === prev) ? null : prev
      );
    } catch (err) {
      handleError(err);
    }
  }, [deletedCards, handleError]);

  const visibleCards = useMemo(() => {
    const activeCards = cards.filter((card) => !card.deletedAt);
    const isArchived = (card: BankCardSummary) => card.tags?.includes('archived');
    let pool: BankCardSummary[];

    if (selectedNav === 'all') {
      pool = activeCards.filter((card) => !isArchived(card));
    } else if (selectedNav === 'favorites') {
      pool = activeCards.filter((card) => card.isFavorite && !isArchived(card));
    } else if (selectedNav === 'archive') {
      pool = activeCards.filter((card) => isArchived(card));
    } else if (selectedNav === 'deleted') {
      pool = deletedCards;
    } else {
      pool = activeCards;
    }

    if (!debouncedSearchQuery.trim()) return pool;

    const query = debouncedSearchQuery.toLowerCase();
    return pool.filter((card) => {
      const fields = [card.title, card.holder, card.number, card.metaLine, ...(card.tags || [])];
      return fields.some((field) => field && field.toLowerCase().includes(query));
    });
  }, [cards, debouncedSearchQuery, deletedCards, selectedNav]);

  const selectedCard = useMemo(() => {
    if (selectedCardId && cardDetailsById[selectedCardId]) {
      return cardDetailsById[selectedCardId];
    }
    const pool = isTrashMode ? deletedCards : cards;
    return pool.find((card) => card.id === selectedCardId) ?? null;
  }, [cardDetailsById, cards, deletedCards, isTrashMode, selectedCardId]);

  const currentSectionTitle = useMemo(() => {
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
  }, [selectedNav, tVault]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const current = cards.find((card) => card.id === id);
      if (!current) return;

      const nextFavorite = !current.isFavorite;

      try {
        await setBankCardFavorite({ id: current.id, is_favorite: nextFavorite });

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
      const isArchived = (card: BankCardSummary) => card.tags?.includes('archived');

      return {
        all: activeCards.filter((card) => !isArchived(card)).length,
        favorites: activeCards.filter((card) => card.isFavorite && !isArchived(card)).length,
        archive: activeCards.filter((card) => isArchived(card)).length,
        deleted: deletedCards.length,
        folders: {},
      };
    },
    [cards, deletedCards]
  );

  return {
    cards,
    deletedCards,
    selectedNav,
    selectedCardId,
    selectedCard,
    isTrashMode,
    counts,
    currentSectionTitle,
    searchQuery: searchInput,
    setSearchQuery: setSearchInput,
    loading,
    error,
    visibleCards,
    refreshActive,
    refreshTrash,
    selectNav,
    selectCard,
    createCard: createCardAction,
    updateCard: updateCardAction,
    deleteCard: deleteCardAction,
    restoreCard: restoreCardAction,
    purgeCard: purgeCardAction,
    restoreAllTrash: restoreAllTrashAction,
    purgeAllTrash: purgeAllTrashAction,
    loadCard,
    toggleFavorite,
    settings,
    updateSettings: updateSettingsAction,
    setSettings: setSettingsState,
  };
}
