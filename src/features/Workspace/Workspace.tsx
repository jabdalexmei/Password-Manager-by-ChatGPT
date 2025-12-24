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
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? null,
    [selectedId, workspaces]
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

  const handleOpenDataFolder = useCallback(async () => {
    if (!selectedWorkspace || !selectedWorkspace.is_active || !selectedWorkspace.valid) {
      return;
    }
    await workspaceOpenInExplorer();
  }, [selectedWorkspace]);

  const canOpenDataFolder =
    Boolean(selectedWorkspace?.is_active) && Boolean(selectedWorkspace?.valid);

  const workspaceListContent = useMemo(() => {
    if (loading) {
      return <p className="muted centered">{t('loading')}</p>;
    }

    if (error) {
      return <p className="muted centered">{t('error')}</p>;
    }

    if (!workspaces.length) {
      return (
        <div className="empty-state">
          <p>{t('empty')}</p>
        </div>
      );
    }

    return (
      <div className="workspace-list">
        {workspaces.map((workspace) => {
          const statusLabel = workspace.exists
            ? workspace.valid
              ? null
              : t('invalid')
            : t('missing');
          const isSelected = workspace.id === selectedId;
          return (
            <div
              key={workspace.id}
              className={`workspace-item ${isSelected ? 'selected' : ''} ${
                workspace.is_active ? 'active' : ''
              }`}
              onClick={() => setSelectedId(workspace.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSelectedId(workspace.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="workspace-item-header">
                <div>
                  <p className="workspace-name">{workspace.display_name}</p>
                  <p className="workspace-path">{workspace.path}</p>
                </div>
                {statusLabel && <span className="badge">{statusLabel}</span>}
              </div>
              <div className="workspace-item-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSelect(workspace.id);
                  }}
                  disabled={!workspace.valid || busy}
                >
                  {t('open')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(workspace.id);
                  }}
                  disabled={busy}
                >
                  {t('removeFromList')}
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
      <div className="workspace-card">
        <header className="workspace-header">
          <h1 className="workspace-title">{t('title')}</h1>
          <p className="workspace-subtitle">{t('subtitle')}</p>
        </header>
        <div className="workspace-layout">
          <section>
            <h2 className="workspace-section-title">{t('workspaces')}</h2>
            {workspaceListContent}
          </section>
          <section className="workspace-controls">
            <div className="workspace-control-block">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={useDefaultPath}
                  onChange={(event) => setUseDefaultPath(event.target.checked)}
                />
                <span>{t('useDefaultPath')}</span>
              </label>
            </div>
            <div className="workspace-control-block">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={busy}
              >
                {t('create')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenDataFolder}
                disabled={!canOpenDataFolder || busy}
              >
                {t('openDataFolder')}
              </button>
            </div>
            {selectedWorkspace && (
              <div className="workspace-selection">
                <p className="workspace-selection-label">{t('selected')}</p>
                <p className="workspace-selection-name">{selectedWorkspace.display_name}</p>
                <p className="workspace-selection-path">{selectedWorkspace.path}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
