import React, { useCallback, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../shared/lib/i18n';
import {
  backupInspect,
  backupRestoreWorkflow,
  workspaceCreate,
  workspaceCreateDefault,
  workspaceOpenInExplorer,
  workspaceSelect,
} from '../../shared/lib/tauri';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import { useToaster } from '../../shared/components/Toaster';
import { useWorkspace } from './hooks/useWorkspace';

type WorkspaceProps = {
  onWorkspaceReady: () => void;
};

const Workspace: React.FC<WorkspaceProps> = ({ onWorkspaceReady }) => {
  const { t } = useTranslation('Workspace');
  const { show: showToast } = useToaster();
  const { workspaces, loading, error, selectedId, setSelectedId, refresh, remove } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingBackupPath, setPendingBackupPath] = useState<string | null>(null);
  const [pendingProfileName, setPendingProfileName] = useState<string>('');

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedId) ?? null,
    [selectedId, workspaces]
  );

  const activeWorkspace = useMemo(() => workspaces.find((w) => w.is_active) ?? null, [workspaces]);

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

  // Create: always pick a folder and initialize it as workspace
  const handleCreate = useCallback(async () => {
    setBusy(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('chooseFolder'),
      });
      if (typeof selected !== 'string') return;
      await workspaceCreate(selected);
      await refresh();
      onWorkspaceReady();
    } finally {
      setBusy(false);
    }
  }, [onWorkspaceReady, refresh, t]);

  // Create in default path: no picker
  const handleCreateDefault = useCallback(async () => {
    setBusy(true);
    try {
      await workspaceCreateDefault();
      await refresh();
      onWorkspaceReady();
    } finally {
      setBusy(false);
    }
  }, [onWorkspaceReady, refresh]);

  const handleRestoreFromBackup = useCallback(async () => {
    setBusy(true);
    try {
      const backup = await open({
        directory: false,
        multiple: false,
        title: t('chooseBackupFile'),
        filters: [{ name: 'Backup', extensions: ['zip'] }],
      });
      if (typeof backup !== 'string') return;

      const targetFolder = await open({
        directory: true,
        multiple: false,
        title: t('chooseFolder'),
      });
      if (typeof targetFolder !== 'string') return;

      await workspaceCreate(targetFolder);
      await refresh();

      const info = await backupInspect(backup);
      setPendingBackupPath(backup);
      setPendingProfileName(info.profile_name);

      if (info.will_overwrite) {
        setConfirmOpen(true);
        return;
      }

      showToast(t('restoreInfoCreate', { name: info.profile_name }), 'success');
      await backupRestoreWorkflow(backup);
      showToast(t('restoreSuccess'), 'success');
      onWorkspaceReady();
    } finally {
      setBusy(false);
    }
  }, [onWorkspaceReady, refresh, showToast, t]);

  // IMPORTANT: this button acts as:
  // - browse/select folder (always opens picker)
  // - if the picked folder equals the current active valid workspace -> open in Explorer
  const handleOpenDataFolder = useCallback(async () => {
    setBusy(true);
    try {
      // Always open directory picker first (acts as "Browse…")
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('chooseFolder'),
      });

      if (typeof selected !== 'string') {
        return; // cancelled
      }

      // If user picked the currently active valid workspace -> just reveal it in Explorer
      if (
        activeWorkspace &&
        activeWorkspace.exists &&
        activeWorkspace.valid &&
        activeWorkspace.path === selected
      ) {
        await workspaceOpenInExplorer();
        return;
      }

      // Otherwise initialize/add this folder as a workspace
      await workspaceCreate(selected);

      await refresh();
      onWorkspaceReady();
    } finally {
      setBusy(false);
    }
  }, [activeWorkspace, onWorkspaceReady, refresh, t]);

  const workspaceListContent = useMemo(() => {
    if (loading) return <p className="muted centered">{t('loading')}</p>;
    if (error) return <p className="muted centered">{t('error')}</p>;

    if (!workspaces.length) {
      return (
        <div className="empty empty--dashed">
          <p className="empty-text">{t('empty')}</p>
        </div>
      );
    }

    return (
      <div className="workspace-list">
        {workspaces.map((workspace) => {
          const isSelected = workspace.id === selectedId;
          const statusLabel = workspace.exists ? (workspace.valid ? null : t('invalid')) : t('missing');

          return (
            <div
              key={workspace.id}
              className={`workspace-tile tile tile--selectable ${isSelected ? 'tile--selected' : ''}`}
              onClick={() => setSelectedId(workspace.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setSelectedId(workspace.id);
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
    <div className="screen-shell">
      <div className="screen-card screen-card--xl workspace-card-mock">
        <header className="workspace-header">
          <h1 className="workspace-title">{t('title')}</h1>
          <p className="workspace-subtitle">{t('subtitle')}</p>
        </header>

        {/* 2-row grid:
            row 1: left title only
            row 2: left list + right actions aligned to list top */}
        <div className="workspace-mock-layout">
          <div className="workspace-left-title">
            <h2 className="workspace-section-title">{t('workspaces')}</h2>
          </div>
          <div className="workspace-right-title-spacer" />

          <section className="workspace-left">{workspaceListContent}</section>

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
              className="btn btn-primary workspace-cta"
              onClick={handleCreateDefault}
              disabled={busy}
            >
              {t('createDefaultPath')}
            </button>

            <button
              type="button"
              className="btn btn-primary workspace-cta"
              onClick={handleRestoreFromBackup}
              disabled={busy}
            >
              {t('restoreFromBackup')}
            </button>

            <button
              type="button"
              className="btn btn-secondary workspace-cta-secondary"
              onClick={handleOpenDataFolder}
              disabled={busy}
            >
              {t('openDataFolder')}
            </button>

            <div className="workspace-selection-hint" aria-hidden="true">
              {selectedWorkspace ? selectedWorkspace.display_name : ''}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t('restoreConfirmTitle')}
        description={t('restoreConfirmOverwrite', { name: pendingProfileName })}
        confirmLabel={t('restoreFromBackup')}
        cancelLabel={t('cancel')}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingBackupPath(null);
        }}
        onConfirm={async () => {
          const path = pendingBackupPath;
          setConfirmOpen(false);
          setPendingBackupPath(null);
          if (!path) return;
          setBusy(true);
          try {
            await backupRestoreWorkflow(path);
            showToast(t('restoreSuccess'), 'success');
            onWorkspaceReady();
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
};

export default Workspace;
