import { useVault } from "./useVault";
type VaultProps = {
  profileId: string;
  profileName: string;
  onLocked: () => void;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Vault({ profileId, profileName, onLocked }: VaultProps) {
  const {
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
  } = useVault({ profileId, onLocked });

  // Если залочено — App всё равно перекинет в login, но чтобы не мигало:
  if (status === "locked") return null;

  return (
    <div className="vault-shell">
      <header className="vault-appbar">
        <div className="vault-profile">
          <div className="vault-title">Vault</div>
          <div className="vault-subtitle">Active profile: {profileName}</div>
        </div>

        <div className="vault-actions">
          <button className="vault-action-button" type="button" title="Export" aria-label="Export">
            <IconDownload />
          </button>
          <button className="vault-action-button" type="button" title="Import" aria-label="Import">
            <IconUpload />
          </button>
          <button className="vault-action-button" type="button" title="Settings" aria-label="Settings">
            <IconSettings />
          </button>
          <button className="vault-action-button" type="button" title="Lock" aria-label="Lock">
            <IconLock />
          </button>
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
              <button className="btn btn-primary" type="button">
                Add data card
              </button>
              <button className="btn btn-ghost" type="button">
                Add folder
              </button>
            </div>
          </div>

          <div className="vault-sidebar-title">Folders</div>

          <ul className="vault-folder-list">
            {folderItems.map((it) => (
              <li key={it.id} className={selectedFolderId === it.id ? "active" : ""}>
                <button type="button" className="vault-folder" onClick={() => selectFolder(it.id)}>
                  <span className="folder-name">{it.label}</span>
                  <span className="folder-count">{it.count}</span>
                </button>
              </li>
            ))}

            {folders.map((f) => (
              <li key={f.id} className={selectedFolderId === f.id ? "active" : ""}>
                <button type="button" className="vault-folder" onClick={() => selectFolder(f.id)}>
                  <span className="folder-name">{f.name}</span>
                  <span className="folder-count">{perFolderCounts[f.id] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* CENTER */}
        <section className="vault-datacards">
          <header className="vault-section-header">
            <span>Cards</span>
          </header>

          <div className="vault-datacard-list" role="listbox">
            {visibleDataCards.length === 0 ? (
              <div className="vault-empty">Empty</div>
            ) : (
              visibleDataCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={card.id === selectedDataCardId ? "vault-datacard active" : "vault-datacard"}
                  onClick={() => selectDataCard(card.id)}
                >
                  <div className="datacard-title">{card.title}</div>
                  <div className="datacard-meta">
                    <span>{card.username || card.email || ""}</span>
                    {card.favorite && <span className="pill">Favorite</span>}
                    <span className="muted">Updated {formatDate(card.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* RIGHT */}
        <section className="vault-details">
          <header className="vault-section-header">Details</header>

          {!selectedDataCard ? (
            <div className="vault-empty">Select an item</div>
          ) : (
            <div className="vault-detail-card">
              <div className="detail-row detail-row-top">
                <div className="detail-dates">
                  <div className="detail-field detail-field-date">
                    <div className="detail-label">Created</div>
                    <div className="detail-value-box">
                      <span className="detail-value-text">{formatDate(selectedDataCard.createdAt)}</span>
                    </div>
                  </div>

                  <div className="detail-field detail-field-date">
                    <div className="detail-label">Last updated</div>
                    <div className="detail-value-box">
                      <span className="detail-value-text">{formatDate(selectedDataCard.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-actions">
                  <button className="btn btn-ghost" type="button">
                    Mark favorite
                  </button>
                  <button className="btn btn-ghost" type="button">
                    Edit
                  </button>
                  <button className="btn btn-danger" type="button">
                    Delete
                  </button>
                </div>
              </div>

              <div className="detail-field-list">
                <DetailRow label="Title" value={selectedDataCard.title} onCopy={copyToClipboard} />
                <DetailRow label="URL" value={selectedDataCard.url} onCopy={copyToClipboard} />
                <DetailRow label="Username" value={selectedDataCard.username} onCopy={copyToClipboard} />
                <DetailRow label="Email" value={selectedDataCard.email} onCopy={copyToClipboard} />
                <DetailRow label="Mobile phone" value={selectedDataCard.mobilePhone} onCopy={copyToClipboard} />

                <div className="detail-field">
                  <div className="detail-label">Password</div>
                  <div className="detail-value-box">
                    <span className="detail-value-text detail-value-text-monospace">
                      {showPassword ? selectedDataCard.password : "•".repeat(14)}
                    </span>

                    <div className="detail-value-actions">
                      <button className="icon-button" type="button" onClick={() => copyToClipboard(selectedDataCard.password)}><IconCopy /> </button>
                      <button className="icon-button" type="button" onClick={togglePassword} aria-label="Toggle password">
                        {showPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                  </div>
                </div>

                <DetailRow label="Notes" value={selectedDataCard.notes} onCopy={copyToClipboard} multiline />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
  multiline,
}: {
  label: string;
  value?: string;
  onCopy: (v?: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "detail-field detail-field-notes" : "detail-field"}>
      <div className="detail-label">{label}</div>
      <div className={multiline ? "detail-value-box detail-value-multiline" : "detail-value-box"}>
        <span className={multiline ? "detail-value-text detail-value-text-multiline" : "detail-value-text"}>
          {value ?? ""}
        </span>
        <button className="icon-button" type="button" onClick={() => onCopy(value)}><IconCopy /> </button>
      </div>
    </div>
  );
}

/* ===== Icons ===== */

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16h-9V7h9v14Z"
      />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c5.05 0 9.27 3.11 11 7-1.73 3.89-5.95 7-11 7S2.73 15.89 1 12c1.73-3.89 5.95-7 11-7Zm0 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-2.2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z"
      />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.1 3.51 3.5 2.1 21.9 20.5l-1.41 1.4-3.2-3.2c-1.55.66-3.32 1.05-5.29 1.05-5.05 0-9.27-3.11-11-7 1.02-2.3 2.78-4.28 5.03-5.55L2.1 3.51Zm7.36 7.36a2.8 2.8 0 0 0 3.67 3.67l-3.67-3.67Zm2.54-5.67c5.05 0 9.27 3.11 11 7-.63 1.42-1.6 2.72-2.82 3.8l-3.06-3.06a5 5 0 0 0-6.86-6.86L7.7 6.0c1.36-.51 2.8-.8 4.3-.8Z"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4.01 4a1 1 0 0 1-1.4 0l-4.01-4a1 1 0 1 1 1.4-1.41L11 13.59V4a1 1 0 0 1 1-1Zm-7 16a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"
      />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 21a1 1 0 0 1-1-1v-9.59l-2.3 2.3a1 1 0 1 1-1.4-1.42l4.01-4a1 1 0 0 1 1.4 0l4.01 4a1 1 0 1 1-1.4 1.41L13 10.41V20a1 1 0 0 1-1 1ZM5 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.8.8 0 0 0 .19-1.02l-1.92-3.32a.8.8 0 0 0-.97-.35l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.8.8 0 0 0 12.3 1h-3.6a.8.8 0 0 0-.79.67l-.36 2.54c-.57.23-1.12.54-1.63.94l-2.39-.96a.8.8 0 0 0-.97.35L.64 7.86a.8.8 0 0 0 .19 1.02l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L.83 14.52a.8.8 0 0 0-.19 1.02l1.92 3.32c.2.35.62.5.97.35l2.39-.96c.5.4 1.06.71 1.63.94l.36 2.54c.06.39.4.67.79.67h3.6c.39 0 .73-.28.79-.67l.36-2.54c.57-.23 1.12-.54 1.63-.94l2.39.96c.35.15.77 0 .97-.35l1.92-3.32a.8.8 0 0 0-.19-1.02l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Z"
      />
    </svg>
  );
}
