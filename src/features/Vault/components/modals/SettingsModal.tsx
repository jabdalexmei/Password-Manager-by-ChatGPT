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
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockTimeoutSeconds, setAutoLockTimeoutSeconds] = useState('60');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [maxCopies, setMaxCopies] = useState('10');
  const [retentionDays, setRetentionDays] = useState('30');

  useEffect(() => {
    if (!open || !settings) return;
    setAutoLockEnabled(settings.auto_lock_enabled);
    setAutoLockTimeoutSeconds(String(settings.auto_lock_timeout));
    setAutoBackupEnabled(settings.backups_enabled);
    setIntervalMinutes(String(settings.auto_backup_interval_minutes));
    setMaxCopies(String(settings.backup_max_copies));
    setRetentionDays(String(settings.backup_retention_days));
  }, [open, settings]);

  const busy = isSaving;

  const canSave = useMemo(() => {
    const lockTimeout = Number(autoLockTimeoutSeconds);
    const interval = Number(intervalMinutes);
    const max = Number(maxCopies);
    const retention = Number(retentionDays);
    if (!Number.isFinite(lockTimeout) || !Number.isFinite(interval) || !Number.isFinite(max) || !Number.isFinite(retention)) {
      return false;
    }
    if (autoLockEnabled && (lockTimeout < 30 || lockTimeout > 86400)) return false;
    if (autoBackupEnabled && (interval < 5 || interval > 1440)) return false;
    if (max < 1 || max > 500) return false;
    if (retention < 1 || retention > 3650) return false;
    return true;
  }, [autoBackupEnabled, autoLockEnabled, autoLockTimeoutSeconds, intervalMinutes, maxCopies, retentionDays]);

  const handleSave = () => {
    if (!settings) return;

    const lockTimeout = Number(autoLockTimeoutSeconds);
    const interval = Number(intervalMinutes);
    const max = Number(maxCopies);
    const retention = Number(retentionDays);

    if (!Number.isFinite(lockTimeout)) return;
    if (autoLockEnabled && (lockTimeout < 30 || lockTimeout > 86400)) return;
    if (!Number.isFinite(interval) || !Number.isFinite(max)) return;
    if (autoBackupEnabled && (interval < 5 || interval > 1440)) return;
    if (max < 1 || max > 500) return;
    if (!Number.isFinite(retention) || retention < 1 || retention > 3650) return;

    const nextSettings: BackendUserSettings = {
      ...settings,
      auto_lock_enabled: autoLockEnabled,
      auto_lock_timeout: lockTimeout,
      backups_enabled: autoBackupEnabled,
      auto_backup_interval_minutes: interval,
      backup_max_copies: max,
      backup_retention_days: retention,
    };

    onSave(nextSettings);
  };

  // ---- Layout styles (no borders). "Backups" is a subtitle (h3). ----
  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '20px',
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 140px', // fixed control column (not flush to modal edge)
    alignItems: 'center',
    columnGap: 16,
  };

  // ---- Toggle switch (button role="switch") ----
  // WAI-ARIA switch pattern: role="switch" + aria-checked true/false, keyboard operable.
  // https://www.w3.org/WAI/ARIA/apg/patterns/switch/
  // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/switch_role
  const switchButtonStyle: React.CSSProperties = {
    width: 44,
    height: 24,
    borderRadius: 9999,
    border: autoBackupEnabled
      ? '1px solid rgba(34, 197, 94, 0.95)'
      : '1px solid rgba(255, 255, 255, 0.25)',
    background: autoBackupEnabled
      ? 'rgba(34, 197, 94, 0.55)'
      : 'rgba(255, 255, 255, 0.14)',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.65 : 1,
    outline: 'none',
  };


  const switchThumbStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: 9999,
    background: 'rgba(255, 255, 255, 0.95)',
    transform: autoBackupEnabled ? 'translateX(22px)' : 'translateX(2px)',
    transition: 'transform 160ms ease',
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
          <h3 id="security-title" style={subtitleStyle}>
            Security
          </h3>

          <div
            role="group"
            aria-labelledby="security-title"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="form-field" style={toggleRowStyle}>
              <label className="form-label" id="auto-lock-enabled-label" htmlFor="auto-lock-enabled-switch">
                Enable auto-lock
              </label>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  id="auto-lock-enabled-switch"
                  type="button"
                  role="switch"
                  aria-checked={autoLockEnabled}
                  aria-labelledby="auto-lock-enabled-label"
                  disabled={busy}
                  onClick={() => setAutoLockEnabled((v) => !v)}
                  onKeyDown={(e) => {
                    if (busy) return;
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setAutoLockEnabled((v) => !v);
                    }
                  }}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 9999,
                    border: autoLockEnabled
                      ? '1px solid rgba(34, 197, 94, 0.95)'
                      : '1px solid rgba(255, 255, 255, 0.25)',
                    background: autoLockEnabled
                      ? 'rgba(34, 197, 94, 0.55)'
                      : 'rgba(255, 255, 255, 0.14)',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.65 : 1,
                    outline: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9999,
                      background: 'rgba(255, 255, 255, 0.95)',
                      transform: autoLockEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      transition: 'transform 160ms ease',
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="auto-lock-timeout-seconds">
                Auto-lock timeout (seconds)
              </label>
              <input
                id="auto-lock-timeout-seconds"
                type="number"
                min={30}
                max={86400}
                value={autoLockTimeoutSeconds}
                disabled={busy || !autoLockEnabled}
                inputMode="numeric"
                onChange={(event) => setAutoLockTimeoutSeconds(event.target.value)}
                style={fullWidthInputStyle}
              />
            </div>
          </div>

          <h3 id="backups-title" style={subtitleStyle}>
            Backups
          </h3>

          <div role="group" aria-labelledby="backups-title" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field" style={toggleRowStyle}>
              <label className="form-label" id="backup-auto-enabled-label" htmlFor="backup-auto-enabled-switch">
                Auto backup enabled
              </label>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  id="backup-auto-enabled-switch"
                  type="button"
                  role="switch"
                  aria-checked={autoBackupEnabled}
                  aria-labelledby="backup-auto-enabled-label"
                  disabled={busy}
                  onClick={() => setAutoBackupEnabled((v) => !v)}
                  onKeyDown={(e) => {
                    // Space/Enter toggles for keyboard users
                    if (busy) return;
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setAutoBackupEnabled((v) => !v);
                    }
                  }}
                  style={switchButtonStyle}
                >
                  <span style={switchThumbStyle} />
                </button>
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
              <label className="form-label" htmlFor="backup-max-copies">
                Max copies
              </label>
              <input
                id="backup-max-copies"
                type="number"
                min={1}
                max={500}
                value={maxCopies}
                disabled={busy}
                inputMode="numeric"
                onChange={(event) => setMaxCopies(event.target.value)}
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
