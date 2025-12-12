import { useEffect, useMemo, useState } from "react";
import {
  loadVaultEntries,
  loadVaultFolders,
  persistVaultEntries,
  persistVaultFolders,
} from "./storage";
import { VaultEntry, VaultFolder } from "./types";

const ALL = "all";
const FAVORITES = "favorites";
const ARCHIVE = "archive";
const DELETED = "deleted";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Vault() {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>(ALL);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const f = loadVaultFolders("1");
    const e = loadVaultEntries("1");
    setFolders(f);
    setEntries(e);
    setSelectedEntryId(e[0]?.id ?? null);
  }, []);

  useEffect(() => persistVaultFolders("1", folders), [folders]);
  useEffect(() => persistVaultEntries("1", entries), [entries]);

  const folderCounts = useMemo(() => {
    const notDeleted = entries.filter((x) => !x.deletedAt);
    return {
      all: notDeleted.length,
      favorites: notDeleted.filter((x) => x.favorite).length,
      archive: notDeleted.filter((x) => x.archived).length,
      deleted: entries.filter((x) => !!x.deletedAt).length,
    };
  }, [entries]);

  const perFolderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of folders) map[f.id] = 0;
    for (const e of entries) {
      if (e.deletedAt) continue;
      map[e.folderId] = (map[e.folderId] ?? 0) + 1;
    }
    return map;
  }, [folders, entries]);

  const visibleEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = entries;

    if (selectedFolder === FAVORITES) base = base.filter((x) => x.favorite && !x.deletedAt);
    else if (selectedFolder === ARCHIVE) base = base.filter((x) => x.archived && !x.deletedAt);
    else if (selectedFolder === DELETED) base = base.filter((x) => !!x.deletedAt);
    else if (selectedFolder !== ALL) base = base.filter((x) => x.folderId === selectedFolder && !x.deletedAt);
    else base = base.filter((x) => !x.deletedAt);

    if (!q) return base;
    return base.filter((x) => `${x.title} ${x.username ?? ""} ${x.email ?? ""} ${x.url ?? ""}`.toLowerCase().includes(q));
  }, [entries, selectedFolder, search]);

  const selectedEntry = useMemo(
    () => entries.find((x) => x.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  const copy = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
  };

  const folderItems: Array<{ id: string; label: string; count: number }> = [
    { id: ALL, label: "All items", count: folderCounts.all },
    { id: FAVORITES, label: "Favorites", count: folderCounts.favorites },
    { id: ARCHIVE, label: "Archive", count: folderCounts.archive },
    { id: DELETED, label: "Deleted", count: folderCounts.deleted },
  ];

  return (
    <div className="vault-shell">
      <header className="vault-appbar">
        <div className="vault-profile">
          <div className="vault-title">Vault</div>
          <div className="vault-subtitle">Active profile: 1</div>
        </div>

        {/* как на эталоне: иконки справа */}
        <div className="vault-actions">
          <button className="vault-action-button" type="button" title="Export">⬇</button>
          <button className="vault-action-button" type="button" title="Import">⬆</button>
          <button className="vault-action-button" type="button" title="Settings">⚙</button>
          <button className="vault-action-button" type="button" title="Lock">🔒</button>
        </div>
      </header>

      <div className="vault-body">
        {/* LEFT */}
        <aside className="vault-sidebar">
          <div className="vault-sidebar-controls">
            <input
              className="vault-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vault"
            />

            <div className="vault-sidebar-actions">
              <button className="btn btn-primary" type="button">Add data card</button>
              <button className="btn btn-ghost" type="button">Add folder</button>
            </div>
          </div>

          <div className="vault-sidebar-title">Folders</div>

          {/* важно: ul/li + li.active — иначе не будет подсветки активной папки */}
          <ul className="vault-folder-list">
            {folderItems.map((it) => (
              <li key={it.id} className={selectedFolder === it.id ? "active" : ""}>
                <button
                  type="button"
                  className="vault-folder"
                  onClick={() => setSelectedFolder(it.id)}
                >
                  <span className="folder-name">{it.label}</span>
                  <span className="folder-count">{it.count}</span>
                </button>
              </li>
            ))}

            {folders.map((f) => (
              <li key={f.id} className={selectedFolder === f.id ? "active" : ""}>
                <button
                  type="button"
                  className="vault-folder"
                  onClick={() => setSelectedFolder(f.id)}
                >
                  <span className="folder-name">{f.name}</span>
                  <span className="folder-count">{perFolderCounts[f.id] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* CENTER */}
<section className="vault-datacards vault-entries">
  <header className="vault-section-header entries-header">
    <span>Cards</span>
  </header>

  <div className="vault-datacard-list vault-entry-list" role="listbox">
    {visibleEntries.length === 0 ? (
      <div className="vault-empty">Empty</div>
    ) : (
      visibleEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={
            entry.id === selectedEntryId
              ? "vault-datacard vault-entry active"
              : "vault-datacard vault-entry"
          }
          onClick={() => {
            setSelectedEntryId(entry.id);
            setShowPassword(false);
          }}
        >
          <div className="entry-title">{entry.title}</div>

          <div className="entry-meta">
            <span>{entry.username || entry.email || ""}</span>

            {entry.favorite && <span className="pill">Favorite</span>}

            <span className="muted">Updated {formatDate(entry.updatedAt)}</span>
          </div>
        </button>
      ))
    )}
  </div>
</section>


        {/* RIGHT */}
        <section className="vault-details">
          <header className="vault-section-header">Details</header>

          {!selectedEntry ? (
            <div className="vault-empty">Select an item</div>
          ) : (
            <div className="vault-detail-card">
              {/* top row: created/updated + actions */}
              <div className="detail-row detail-row-top">
                <div className="detail-dates">
                  <div className="detail-field detail-field-date">
                    <div className="detail-label">Created</div>
                    <div className="detail-value-box">
                      <span className="detail-value-text">{formatDate(selectedEntry.createdAt)}</span>
                    </div>
                  </div>

                  <div className="detail-field detail-field-date">
                    <div className="detail-label">Last updated</div>
                    <div className="detail-value-box">
                      <span className="detail-value-text">{formatDate(selectedEntry.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-actions">
                  <button className="btn btn-ghost" type="button">Mark favorite</button>
                  <button className="btn btn-ghost" type="button">Edit</button>
                  <button className="btn btn-danger" type="button">Delete</button>
                </div>
              </div>

              <div className="detail-field-list">
                <div className="detail-field">
                  <div className="detail-label">Title</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text">{selectedEntry.title}</span>
                    <button className="icon-button" type="button" onClick={() => copy(selectedEntry.title)}>⧉</button>
                  </div>
                </div>

                <div className="detail-field">
                  <div className="detail-label">URL</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text">{selectedEntry.url ?? ""}</span>
                    <button className="icon-button" type="button" onClick={() => copy(selectedEntry.url)}>⧉</button>
                  </div>
                </div>

                <div className="detail-field">
                  <div className="detail-label">Username</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text">{selectedEntry.username ?? ""}</span>
                    <button className="icon-button" type="button" onClick={() => copy(selectedEntry.username)}>⧉</button>
                  </div>
                </div>

                <div className="detail-field">
                  <div className="detail-label">Email</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text">{selectedEntry.email ?? ""}</span>
                    <button className="icon-button" type="button" onClick={() => copy(selectedEntry.email)}>⧉</button>
                  </div>
                </div>

                <div className="detail-field">
                  <div className="detail-label">Mobile phone</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text">{selectedEntry.mobilePhone ?? ""}</span>
                    <button className="icon-button" type="button" onClick={() => copy(selectedEntry.mobilePhone)}>⧉</button>
                  </div>
                </div>

                <div className="detail-field">
                  <div className="detail-label">Password</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text detail-value-text-monospace">
                      {showPassword ? (selectedEntry.password ?? "") : "•".repeat(14)}
                    </span>

                    <div className="detail-value-actions">
                      <button className="icon-button" type="button" onClick={() => copy(selectedEntry.password)}>⧉</button>
                      <button className="icon-button" type="button" onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="detail-field detail-field-notes">
                  <div className="detail-label">Notes</div>
                  <div className="detail-value-box detail-value-multiline">
                    <span className="detail-value-text detail-value-text-multiline">
                      {selectedEntry.notes ?? ""}
                    </span>
                    <button className="icon-button" type="button" onClick={() => copy(selectedEntry.notes)}>⧉</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
