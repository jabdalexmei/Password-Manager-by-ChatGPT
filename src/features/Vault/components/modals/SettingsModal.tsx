import React, { useEffect, useMemo, useState } from 'react';
import { BackendUserSettings } from '../../types/backend';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';

export type SettingsModalProps = {
  open: boolean;
  settings: BackendUserSettings | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (nextSettings: BackendUserSettings) => void;
};

export function SettingsModal({ open, settings, isSaving, onCancel, onSave }: SettingsModalProps) {
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [retentionDays, setRetentionDays] = useState('30');

  useEffect(() => {
    if (!open || !settings) return;
    setAutoBackupEnabled(settings.backups_enabled);
    setIntervalMinutes(String(settings.auto_backup_interval_minutes));
    setRetentionDays(String(settings.backup_retention_days));
  }, [open, settings]);

  const busy = isSaving;

  const canSave = useMemo(() => {
    const interval = Number(intervalMinutes);
    const retention = Number(retentionDays);
    if (!Number.isFinite(interval) || !Number.isFinite(retention)) return false;
    if (autoBackupEnabled && (interval < 5 || interval > 1440)) return false;
    if (retention < 1 || retention > 3650) return false;
    return true;
  }, [autoBackupEnabled, intervalMinutes, retentionDays]);

  const handleSave = () => {
    if (!settings) return;

    const interval = Number(intervalMinutes);
    const retention = Number(retentionDays);

    if (!Number.isFinite(interval)) return;
    if (autoBackupEnabled && (interval < 5 || interval > 1440)) return;
    if (!Number.isFinite(retention) || retention < 1 || retention > 3650) return;

    const nextSettings: BackendUserSettings = {
      ...settings,
      backups_enabled: autoBackupEnabled,
      auto_backup_interval_minutes: interval,
      backup_retention_days: retention,
    };

    onSave(nextSettings);
  };

  // Layout-only styles (NO borders). We use a semantic group with aria-labelledby instead of <fieldset>/<legend>
  // so "Backups" renders as a normal subtitle (h3).
  const sectionWrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '20px',
  };

  // Label left, checkbox in a fixed "control column" (not flush to modal edge)
  const toggleRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 140px',
    alignItems: 'center',
    columnGap: 16,
  };

  const toggleControlStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
  };

  const fullWidthInputStyle: React.CSSProperties = {
    width: '100%',
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <DialogContent aria-labelledby="settings-title">
        <DialogHeader>
          <DialogTitle id="settings-title">Settings</DialogTitle>
        </DialogHeader>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Subtitle + grouped controls */}
          <h3 id="backups-title" style={subtitleStyle}>
            Backups
          </h3>

          <div role="group" aria-labelledby="backups-title" style={sectionWrapStyle}>
            <div className="form-field" style={toggleRowStyle}>
              <label className="form-label" htmlFor="backup-auto-enabled">
                Auto backup enabled
              </label>

              <div style={toggleControlStyle}>
                <input
                  id="backup-auto-enabled"
                  type="checkbox"
                  checked={autoBackupEnabled}
                  disabled={busy}
                  onChange={(event) => setAutoBackupEnabled(event.target.checked)}
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="backup-interval-minutes">
                Interval (minutes)
              </label>
              <input
                id="backup-interval-minutes"
                type="number"
                min={5}
                max={1440}
                value={intervalMinutes}
                disabled={busy || !autoBackupEnabled}
                inputMode="numeric"
                onChange={(event) => setIntervalMinutes(event.target.value)}
                style={fullWidthInputStyle}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="backup-retention-days">
                Retention days
              </label>
              <input
                id="backup-retention-days"
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                disabled={busy}
                inputMode="numeric"
                onChange={(event) => setRetentionDays(event.target.value)}
                style={fullWidthInputStyle}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="dialog-footer--split">
          <div className="dialog-footer-left">
            <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          </div>

          <div className="dialog-footer-right">
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={busy || !settings || !canSave}>
              Save
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
