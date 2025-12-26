import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { BackendUserSettings } from '../../types/backend';

export type SettingsModalProps = {
  open: boolean;
  settings: BackendUserSettings | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (nextSettings: BackendUserSettings) => void;
};

export function SettingsModal({ open, settings, isSaving, onCancel, onSave }: SettingsModalProps) {
  const { t } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [retentionDays, setRetentionDays] = useState('30');

  useEffect(() => {
    if (!open || !settings) return;
    setAutoBackupEnabled(settings.backups_enabled);
    setIntervalMinutes(String(settings.auto_backup_interval_minutes));
    setRetentionDays(String(settings.backup_retention_days));
  }, [open, settings]);

  if (!open) return null;

  const canSave =
    Number.isFinite(Number(intervalMinutes)) &&
    Number(intervalMinutes) >= 5 &&
    Number(intervalMinutes) <= 1440 &&
    Number.isFinite(Number(retentionDays)) &&
    Number(retentionDays) >= 1 &&
    Number(retentionDays) <= 3650;

  const handleSave = () => {
    if (!settings) return;
    const interval = Number(intervalMinutes);
    const retention = Number(retentionDays);
    if (!Number.isFinite(interval) || interval < 5 || interval > 1440) return;
    if (!Number.isFinite(retention) || retention < 1 || retention > 3650) return;
    const nextSettings: BackendUserSettings = {
      ...settings,
      backups_enabled: autoBackupEnabled,
      auto_backup_interval_minutes: interval,
      backup_retention_days: retention,
    };
    onSave(nextSettings);
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="dialog-header">
          <h2 id="settings-title" className="dialog-title">
            {t('backup.settings.title')}
          </h2>
        </div>

        <div className="dialog-body">
          <div className="form-field">
            <label className="form-label" htmlFor="backup-auto-enabled">
              {t('backup.settings.autoEnabled')}
            </label>
            <input
              id="backup-auto-enabled"
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(event) => setAutoBackupEnabled(event.target.checked)}
              disabled={isSaving}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="backup-interval-minutes">
              {t('backup.settings.intervalMinutes')}
            </label>
            <input
              id="backup-interval-minutes"
              className="input"
              type="number"
              min={5}
              max={1440}
              value={intervalMinutes}
              disabled={!autoBackupEnabled || isSaving}
              onChange={(event) => setIntervalMinutes(event.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="backup-retention-days">
              {t('backup.settings.retentionDays')}
            </label>
            <input
              id="backup-retention-days"
              className="input"
              type="number"
              min={1}
              max={3650}
              value={retentionDays}
              disabled={isSaving}
              onChange={(event) => setRetentionDays(event.target.value)}
            />
          </div>
        </div>

        <div className="dialog-footer dialog-footer--split">
          <div className="dialog-footer-left">
            <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={isSaving}>
              {tCommon('action.cancel')}
            </button>
          </div>
          <div className="dialog-footer-right">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleSave}
              disabled={isSaving || !settings || !canSave}
            >
              {t('backup.settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
