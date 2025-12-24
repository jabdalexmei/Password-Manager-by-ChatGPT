import React, { useCallback, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../lib/i18n';
import {
  workspaceCreate,
  workspaceCreateDefault,
  workspaceOpenInExplorer,
  workspaceSelect,
} from '../../lib/tauri';
import { useWorkspace } from './useWorkspace';

type WorkspaceProps = {
  onWorkspaceReady: () => void;
};

const Workspace: React.FC<WorkspaceProps> = ({ onWorkspaceReady }) => {
  const { t } = useTranslation('Workspace');
  const { workspaces, loading, error, selectedId, setSelectedId, refresh, remove } = useWorkspace();
  const [useDefaultPath, setUseDefaultPath] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedId) ?? null,
    [selectedId, workspaces]
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.is_active) ?? null,
    [workspaces]
  );

  const handleSelect = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await workspaceSelect(id);
        await refresh();
        onWorkspaceReady();
      } finally {
        setBusy(false);
      }
    },
    [onWorkspaceReady, refresh]
  );

  const handleCreate = useCallback(async () => {
    setBusy(true);
    try {
      if (useDefaultPath) {
        await workspaceCreateDefault();
      } else {
        const selected = await open({
          directory: true,
          multiple: false,
          title: t('chooseFolder'),
        });
        if (typeof selected !== 'string') {
          return;
        }
        await workspaceCreate(selected);
      }
      await refresh();
      onWorkspaceReady();
    } finally {
      setBusy(false);
    }
  }, [onWorkspaceReady, refresh, t, useDefaultPath]);

  // IMPORTANT: this button acts as:
  // - "open in Explorer" when active workspace is valid
  // - "browse/select folder" when there is no valid active workspace
  const handleOpenDataFolder = useCallback(async () => {
    setBusy(true);
    try {
      if (activeWorkspace && activeWorkspace.exists && activeWorkspace.valid) {
        await workspaceOpenInExplorer();
        return;
      }

      const selected = await open({
        directory: true,
        multiple: false,
        title: t('chooseFolder'),
      });

      if (typeof selected !== 'string') {
        return;
      }

      await workspaceCreate(selected);
      await refresh();
      onWorkspaceReady();
    } finally {
      setBusy(false);
    }
  }, [activeWorkspace, onWorkspaceReady, refresh, t]);

  const workspaceListContent = useMemo(() => {
    if (loading) {
      return <p className="muted centered">{t('loading')}</p>;
    }

    if (error) {
      return <p className="muted centered">{t('error')}</p>;
    }

    if (!workspaces.length) {
      return (
        <div className="workspace-empty">
          <p className="workspace-empty-text">{t('empty')}</p>
        </div>
      );
    }

    return (
      <div className="workspace-list">
        {workspaces.map((workspace) => {
          const isSelected = workspace.id === selectedId;

          // keep status info (optional UI chip)
          const statusLabel = workspace.exists
            ? workspace.valid
              ? null
              : t('invalid')
            : t('missing');

          return (
            <div
              key={workspace.id}
              className={`workspace-tile ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedId(workspace.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSelectedId(workspace.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="workspace-tile-top">
                <div className="workspace-tile-info">
                  <div className="workspace-tile-title-row">
                    <p className="workspace-tile-title">{workspace.display_name}</p>
                    {statusLabel && <span className="workspace-status">{statusLabel}</span>}
                  </div>
                  <p className="workspace-tile-path">{workspace.path}</p>
                </div>

                {/* Action Bar placeholder (no behavior for now) */}
                <button
                  type="button"
                  className="btn btn-icon workspace-actionbar"
                  aria-label={t('actions')}
                  title={t('actions')}
                  onClick={(e) => {
                    e.stopPropagation();
                    // intentionally empty (future action menu)
                  }}
                >
                  <span className="workspace-actionbar-dots">⋯</span>
                </button>
              </div>

              <div className="workspace-tile-bottom">
                <button
                  type="button"
                  className="btn btn-danger workspace-btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(workspace.id);
                  }}
                  disabled={busy}
                >
                  {t('removeFromList')}
                </button>

                <button
                  type="button"
                  className="btn btn-primary workspace-btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(workspace.id);
                  }}
                  disabled={!workspace.valid || busy}
                >
                  {t('open')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [busy, error, handleSelect, loading, remove, selectedId, setSelectedId, t, workspaces]);

  return (
    <div className="workspace-shell">
      <div className="workspace-card workspace-card-mock">
        <header className="workspace-header">
          <h1 className="workspace-title">{t('title')}</h1>
          <p className="workspace-subtitle">{t('subtitle')}</p>
        </header>

        <div className="workspace-mock-layout">
          <section className="workspace-left">
            <h2 className="workspace-section-title">{t('workspaces')}</h2>
            {workspaceListContent}
          </section>

          <section className="workspace-right">
            <button
              type="button"
              className="btn btn-primary workspace-cta"
              onClick={handleCreate}
              disabled={busy}
            >
              {t('create')}
            </button>

            <button
              type="button"
              className="btn btn-secondary workspace-cta-secondary"
              onClick={handleOpenDataFolder}
              disabled={busy}
            >
              {t('openDataFolder')}
            </button>

            <label className="workspace-default-path">
              <input
                type="checkbox"
                checked={useDefaultPath}
                onChange={(event) => setUseDefaultPath(event.target.checked)}
                disabled={busy}
              />
              <span>{t('useDefaultPath')}</span>
            </label>

            {/* Optional: keep selection info hidden to match mock exactly */}
            <div className="workspace-selection-hint" aria-hidden="true">
              {selectedWorkspace ? selectedWorkspace.display_name : ''}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
