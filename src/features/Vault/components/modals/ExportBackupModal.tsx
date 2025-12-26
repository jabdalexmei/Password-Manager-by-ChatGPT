import React, { useEffect, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../../../lib/i18n';
import { useToaster } from '../../../../components/Toaster';
import { createBackup } from '../../api/vaultApi';

export type ExportBackupModalProps = {
  open: boolean;
  profileId: string;
  onClose: () => void;
};

const formatTimestamp = () => {
  const now = new Date();
  return now
    .toISOString()
    .replace(/\..+/, '')
    .replace('T', '_')
    .replace(/:/g, '-');
};

export function ExportBackupModal({ open, profileId, onClose }: ExportBackupModalProps) {
  const { t } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const { show: showToast } = useToaster();
  const [useDefaultPath, setUseDefaultPath] = useState(true);
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [suggestedFileName, setSuggestedFileName] = useState('');

  useEffect(() => {
    if (!open) return;
    setUseDefaultPath(true);
    setDestinationPath(null);
    setIsSaving(false);
    const timestamp = formatTimestamp();
    setSuggestedFileName(`backup_${timestamp}_${profileId}.pmbackup.zip`);
  }, [open, profileId]);

  if (!open) return null;

  const handleChoosePath = async () => {
    const selection = await save({
      defaultPath: suggestedFileName,
      filters: [{ name: 'Password Manager Backup', extensions: ['pmbackup', 'zip'] }],
    });

    if (typeof selection === 'string') {
      setDestinationPath(selection);
    }
  };

  const handleCreate = async () => {
    if (!useDefaultPath && !destinationPath) return;
    setIsSaving(true);

    try {
      await createBackup(useDefaultPath ? null : destinationPath, useDefaultPath);
      showToast(t('backup.export.success'), 'success');
      onClose();
    } catch (err: any) {
      const code = err?.code ?? err?.error ?? 'UNKNOWN';
      showToast(`${tCommon('error.operationFailed')} (${code})`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="export-backup-title">
        <div className="dialog-header">
          <h2 id="export-backup-title" className="dialog-title">
            {t('backup.export.title')}
          </h2>
        </div>

        <div className="dialog-body">
          <div
            className="form-field"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px',
              alignItems: 'center',
              columnGap: 16,
            }}
          >
            <span className="form-label" id="use-default-path-label">
              {t('backup.export.useDefaultPath')}
            </span>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                id="use-default-path-switch"
                type="button"
                role="switch"
                aria-checked={useDefaultPath}
                aria-labelledby="use-default-path-label"
                disabled={isSaving}
                onClick={() => setUseDefaultPath((v) => !v)}
                onKeyDown={(e) => {
                  if (isSaving) return;
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setUseDefaultPath((v) => !v);
                  }
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 9999,
                  border: useDefaultPath ? '1px solid rgba(34, 197, 94, 0.95)' : '1px solid rgba(255, 255, 255, 0.25)',
                  background: useDefaultPath ? 'rgba(34, 197, 94, 0.55)' : 'rgba(255, 255, 255, 0.14)',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.65 : 1,
                  outline: 'none',
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9999,
                    background: 'rgba(255, 255, 255, 0.95)',
                    transform: useDefaultPath ? 'translateX(22px)' : 'translateX(2px)',
                    transition: 'transform 160ms ease',
                  }}
                />
              </button>
            </div>
          </div>
          {!useDefaultPath && (
            <div className="form-field">
              <label className="form-label" htmlFor="export-backup-path">
                {t('backup.export.choosePath')}
              </label>
              <button className="btn btn-secondary" type="button" onClick={handleChoosePath} disabled={isSaving}>
                {t('backup.export.choosePath')}
              </button>
              <p id="export-backup-path" className="dialog-description">
                {destinationPath ?? suggestedFileName}
              </p>
            </div>
          )}
        </div>

        <div className="dialog-footer dialog-footer--split">
          <div className="dialog-footer-left">
            <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isSaving}>
              {tCommon('action.cancel')}
            </button>
          </div>
          <div className="dialog-footer-right">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleCreate}
              disabled={isSaving || (!useDefaultPath && !destinationPath)}
            >
              {t('backup.export.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
