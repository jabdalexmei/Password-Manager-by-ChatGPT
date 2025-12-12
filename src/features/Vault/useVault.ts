import { useCallback, useEffect, useMemo, useState } from "react";
import { autoLockCleanup, isLoggedIn } from "../../lib/tauri";
import { loadDataCards, loadFolders, persistDataCards, persistFolders } from "./storage";
import { DataCard, Folder } from "./types";

export type VaultStatus = "ready" | "locked";

export const ALL_FOLDER_ID = "all";
export const FAVORITES_FOLDER_ID = "favorites";
export const ARCHIVE_FOLDER_ID = "archive";
export const DELETED_FOLDER_ID = "deleted";

type UseVaultParams = {
  profileId: string;
  onLocked: () => void;
};

export function useVault({ profileId, onLocked }: UseVaultParams) {
  // Session / autolock
  const [status, setStatus] = useState<VaultStatus>("ready");

  const checkSession = useCallback(async () => {
    await autoLockCleanup();
    const logged = await isLoggedIn();
    setStatus(logged ? "ready" : "locked");
    if (!logged) onLocked();
  }, [onLocked]);

  useEffect(() => {
    const timer = setInterval(checkSession, 5000);
    return () => clearInterval(timer);
  }, [checkSession]);

  // Local data (mock storage пока нет каноничного backend)
  const [folders, setFolders] = useState<Folder[]>([]);
  const [dataCards, setDataCards] = useState<DataCard[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(ALL_FOLDER_ID);
  const [selectedDataCardId, setSelectedDataCardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const f = loadFolders(profileId);
    const cards = loadDataCards(profileId);

    setFolders(f);
    setDataCards(cards);
    setSelectedDataCardId(cards[0]?.id ?? null);
  }, [profileId]);

  useEffect(() => {
    persistFolders(profileId, folders);
  }, [profileId, folders]);

  useEffect(() => {
    persistDataCards(profileId, dataCards);
  }, [profileId, dataCards]);

  const globalCounts = useMemo(() => {
    const alive = dataCards.filter((x) => !x.deletedAt);
    return {
      all: alive.length,
      favorites: alive.filter((x) => x.favorite).length,
      archive: alive.filter((x) => x.archived).length,
      deleted: dataCards.filter((x) => !!x.deletedAt).length,
    };
  }, [dataCards]);

  const perFolderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of folders) map[f.id] = 0;

    for (const c of dataCards) {
      if (c.deletedAt) continue;
      map[c.folderId] = (map[c.folderId] ?? 0) + 1;
    }
    return map;
  }, [folders, dataCards]);

  const visibleDataCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = dataCards;

    if (selectedFolderId === FAVORITES_FOLDER_ID) base = base.filter((x) => x.favorite && !x.deletedAt);
    else if (selectedFolderId === ARCHIVE_FOLDER_ID) base = base.filter((x) => x.archived && !x.deletedAt);
    else if (selectedFolderId === DELETED_FOLDER_ID) base = base.filter((x) => !!x.deletedAt);
    else if (selectedFolderId !== ALL_FOLDER_ID) base = base.filter((x) => x.folderId === selectedFolderId && !x.deletedAt);
    else base = base.filter((x) => !x.deletedAt);

    if (!q) return base;

    return base.filter((x) =>
      `${x.title} ${x.username ?? ""} ${x.email ?? ""} ${x.url ?? ""} ${x.mobilePhone ?? ""} ${x.notes ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [dataCards, selectedFolderId, search]);

  const selectedDataCard = useMemo(() => {
    return dataCards.find((x) => x.id === selectedDataCardId) ?? null;
  }, [dataCards, selectedDataCardId]);

  const selectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
  }, []);

  const selectDataCard = useCallback((dataCardId: string) => {
    setSelectedDataCardId(dataCardId);
    setShowPassword(false);
  }, []);

  const togglePassword = useCallback(() => setShowPassword((v) => !v), []);

  const copyToClipboard = useCallback(async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }, []);

  const folderItems = useMemo(() => {
    return [
      { id: ALL_FOLDER_ID, label: "All items", count: globalCounts.all },
      { id: FAVORITES_FOLDER_ID, label: "Favorites", count: globalCounts.favorites },
      { id: ARCHIVE_FOLDER_ID, label: "Archive", count: globalCounts.archive },
      { id: DELETED_FOLDER_ID, label: "Deleted", count: globalCounts.deleted },
    ];
  }, [globalCounts]);

  return {
    status,

    folders,
    folderItems,
    perFolderCounts,

    selectedFolderId,
    selectFolder,

    search,
    setSearch,

    visibleDataCards,
    selectedDataCardId,
    selectDataCard,

    selectedDataCard,
    showPassword,
    togglePassword,

    copyToClipboard,
  };
}
