import React, { useEffect, useMemo, useState } from 'react';
import { BackendUserSettings } from '../../types/backend';
import { useTranslation } from '../../../../shared/lib/i18n';
import { useToaster } from '../../../../shared/components/Toaster';
import { changeProfilePassword, renameProfile, setProfilePassword, type ProfileMeta } from '../../../../shared/lib/tauri';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog';

export type SettingsModalProps = {
  open: boolean;
  settings: BackendUserSettings | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (nextSettings: BackendUserSettings) => void;
  profileId: string;
  profileName: string;
  profileHasPassword: boolean;
  onProfileRenamed?: (name: string) => void;
  onProfileUpdated?: (profile: ProfileMeta) => void;
};

export function SettingsModal({
  open,
  settings,
  isSaving,
  onCancel,
  onSave,
  profileId,
  profileName,
  profileHasPassword,
  onProfileRenamed,
  onProfileUpdated,
}: SettingsModalProps) {
  const { t: tVault } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const { show: showToast } = useToaster();

  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockTimeoutSeconds, setAutoLockTimeoutSeconds] = useState('60');
  const [clipboardAutoClearEnabled, setClipboardAutoClearEnabled] = useState(false);
  const [clipboardClearTimeoutSeconds, setClipboardClearTimeoutSeconds] = useState('20');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [maxCopies, setMaxCopies] = useState('10');
  const [renameProfileOpen, setRenameProfileOpen] = useState(false);
  const [renameProfileValue, setRenameProfileValue] = useState('');
  const [isRenamingProfile, setIsRenamingProfile] = useState(false);

  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [setPasswordValue, setSetPasswordValue] = useState('');
  const [setPasswordConfirm, setSetPasswordConfirm] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [changePasswordConfirm, setChangePasswordConfirm] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!open || !settings) return;
    setAutoLockEnabled(settings.auto_lock_enabled);
    setAutoLockTimeoutSeconds(String(settings.auto_lock_timeout));
    setClipboardAutoClearEnabled(settings.clipboard_auto_clear_enabled);
    setClipboardClearTimeoutSeconds(String(settings.clipboard_clear_timeout_seconds));
    setAutoBackupEnabled(settings.backups_enabled);
    setIntervalMinutes(String(settings.auto_backup_interval_minutes));
    setMaxCopies(String(settings.backup_max_copies));
  }, [open, settings]);

  useEffect(() => {
    if (!renameProfileOpen) return;
    setRenameProfileValue(profileName || '');
  }, [renameProfileOpen, profileName]);

  useEffect(() => {
    if (!setPasswordOpen) return;
    setSetPasswordValue('');
    setSetPasswordConfirm('');
  }, [setPasswordOpen]);

  useEffect(() => {
    if (!changePasswordOpen) return;
    setChangePasswordValue('');
    setChangePasswordConfirm('');
  }, [changePasswordOpen]);

  const busy = isSaving;

  const canSave = useMemo(() => {
    const lockTimeout = Number(autoLockTimeoutSeconds);
    const clipTimeout = Number(clipboardClearTimeoutSeconds);
    const interval = Number(intervalMinutes);
    const max = Number(maxCopies);
    if (
      !Number.isFinite(lockTimeout) ||
      !Number.isFinite(clipTimeout) ||
      !Number.isFinite(interval) ||
      !Number.isFinite(max)
    ) {
      return false;
    }
    if (autoLockEnabled && (lockTimeout < 30 || lockTimeout > 86400)) return false;
    if (clipTimeout < 1 || clipTimeout > 600) return false;
    if (autoBackupEnabled && (interval < 5 || interval > 1440)) return false;
    if (max < 1 || max > 500) return false;
    return true;
  }, [
    autoBackupEnabled,
    autoLockEnabled,
    autoLockTimeoutSeconds,
    clipboardClearTimeoutSeconds,
    intervalMinutes,
    maxCopies,
  ]);

  const canSaveRename = useMemo(() => {
    const next = renameProfileValue.trim();
    if (!next) return false;
    if (next === (profileName || '').trim()) return false;
    return true;
  }, [profileName, renameProfileValue]);

  const handleRenameSave = async () => {
    const next = renameProfileValue.trim();
    if (!next) return;

    setIsRenamingProfile(true);
    try {
      const updated = await renameProfile(profileId, next);
      onProfileRenamed?.(updated.name);
      showToast(tVault('settingsModal.profile.renameSuccess'));
      setRenameProfileOpen(false);
    } catch {
      showToast(tVault('settingsModal.profile.renameError'), 'error');
    } finally {
      setIsRenamingProfile(false);
    }
  };

  const canSaveSetPassword = useMemo(() => {
    if (profileHasPassword) return false;
    const p1 = setPasswordValue;
    const p2 = setPasswordConfirm;
    if (!p1 || !p2) return false;
    if (p1 !== p2) return false;
    return true;
  }, [profileHasPassword, setPasswordConfirm, setPasswordValue]);

  const canSaveChangePassword = useMemo(() => {
    if (!profileHasPassword) return false;
    const p1 = changePasswordValue;
    const p2 = changePasswordConfirm;
    if (!p1 || !p2) return false;
    if (p1 !== p2) return false;
    return true;
  }, [changePasswordConfirm, changePasswordValue, profileHasPassword]);

  const handleSetPasswordSave = async () => {
    if (profileHasPassword) return;
    if (!canSaveSetPassword) return;

    setIsSettingPassword(true);
    try {
      const updated = await setProfilePassword(profileId, setPasswordValue);
      onProfileUpdated?.(updated);
      showToast(tVault('settingsModal.profile.setPasswordSuccess'));
      setSetPasswordOpen(false);
    } catch (e) {
      // Show real backend error code in console + toast for debugging.
      // Tauri commands can return error values to the frontend. :contentReference[oaicite:1]{index=1}
      // Debugging guidance: webview console/devtools. :contentReference[oaicite:2]{index=2}
      // eslint-disable-next-line no-console
      console.error('profile_set_password failed:', e);
      const code = (e as any)?.message ?? String(e);
      showToast(`${tVault('settingsModal.profile.setPasswordError')}: ${code}`, 'error');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleChangePasswordSave = async () => {
    if (!profileHasPassword) return;
    if (!canSaveChangePassword) return;

    setIsChangingPassword(true);
    try {
      await changeProfilePassword(profileId, changePasswordValue);
      showToast(tVault('settingsModal.profile.changePasswordSuccess'));
      setChangePasswordOpen(false);
    } catch {
      showToast(tVault('settingsModal.profile.changePasswordError'), 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSave = () => {
    if (!settings) return;

    const lockTimeout = Number(autoLockTimeoutSeconds);
    const clipTimeout = Number(clipboardClearTimeoutSeconds);
    const interval = Number(intervalMinutes);
    const max = Number(maxCopies);

    if (!Number.isFinite(lockTimeout)) return;
    if (autoLockEnabled && (lockTimeout < 30 || lockTimeout > 86400)) return;
    if (!Number.isFinite(clipTimeout) || clipTimeout < 1 || clipTimeout > 600) return;
    if (!Number.isFinite(interval) || !Number.isFinite(max)) return;
    if (autoBackupEnabled && (interval < 5 || interval > 1440)) return;
    if (max < 1 || max > 500) return;

    const nextSettings: BackendUserSettings = {
      ...settings,
      auto_lock_enabled: autoLockEnabled,
      auto_lock_timeout: lockTimeout,
      clipboard_auto_clear_enabled: clipboardAutoClearEnabled,
      clipboard_clear_timeout_seconds: clipTimeout,
      backups_enabled: autoBackupEnabled,
      auto_backup_interval_minutes: interval,
      backup_max_copies: max,
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
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <DialogContent aria-labelledby="settings-title">
        <DialogHeader>
          <DialogTitle id="settings-title">{tVault('settings')}</DialogTitle>
        </DialogHeader>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 id="security-title" style={subtitleStyle}>
            {tVault('settingsModal.securityTitle')}
          </h3>

          <div
            role="group"
            aria-labelledby="security-title"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="form-field" style={toggleRowStyle}>
              <span className="form-label settings-subheader" id="auto-lock-enabled-label">
                {tVault('settingsModal.autoLock.enabled')}
              </span>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                {tVault('settingsModal.autoLock.timeoutSeconds')}
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

            <div className="form-field" style={toggleRowStyle}>
              <span className="form-label settings-subheader" id="clipboard-auto-clear-enabled-label">
                {tVault('settingsModal.clipboard.enabled')}
              </span>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  id="clipboard-auto-clear-enabled-switch"
                  type="button"
                  role="switch"
                  aria-checked={clipboardAutoClearEnabled}
                  aria-labelledby="clipboard-auto-clear-enabled-label"
                  disabled={busy}
                  onClick={() => setClipboardAutoClearEnabled((v) => !v)}
                  onKeyDown={(e) => {
                    if (busy) return;
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setClipboardAutoClearEnabled((v) => !v);
                    }
                  }}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 9999,
                    border: clipboardAutoClearEnabled
                      ? '1px solid rgba(34, 197, 94, 0.95)'
                      : '1px solid rgba(255, 255, 255, 0.25)',
                    background: clipboardAutoClearEnabled
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
                      transform: clipboardAutoClearEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      transition: 'transform 160ms ease',
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="clipboard-clear-timeout-seconds">
                {tVault('settingsModal.clipboard.timeoutSeconds')}
              </label>
              <input
                id="clipboard-clear-timeout-seconds"
                type="number"
                min={1}
                max={600}
                value={clipboardClearTimeoutSeconds}
                disabled={busy || !clipboardAutoClearEnabled}
                inputMode="numeric"
                onChange={(event) => setClipboardClearTimeoutSeconds(event.target.value)}
                style={fullWidthInputStyle}
              />
            </div>
          </div>

          <h3 id="backups-title" style={subtitleStyle}>
            {tVault('backup.settings.title')}
          </h3>

          <div role="group" aria-labelledby="backups-title" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field" style={toggleRowStyle}>
              <span className="form-label settings-subheader" id="backup-auto-enabled-label">
                {tVault('backup.settings.autoEnabled')}
              </span>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                {tVault('backup.settings.intervalMinutes')}
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
                {tVault('backup.settings.maxCopies')}
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
          </div>
        </div>

        <h3 id="profile-title" style={subtitleStyle}>
          {tVault('settingsModal.profileTitle')}
        </h3>

        <div role="group" aria-labelledby="profile-title" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field" style={toggleRowStyle}>
            <span className="form-label settings-subheader">{tVault('settingsModal.profile.nameLabel')}</span>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <span
                className="muted"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 260,
                }}
              >
                {profileName || ''}
              </span>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setRenameProfileOpen(true)}
                disabled={busy}
              >
                {tVault('settingsModal.profile.rename')}
              </button>
            </div>
          </div>
        </div>

        <h3 id="profile-security-title" style={subtitleStyle}>
          {tVault('settingsModal.profileSecurityTitle')}
        </h3>

        <div
          role="group"
          aria-labelledby="profile-security-title"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="form-field" style={toggleRowStyle}>
            <span className="form-label settings-subheader">{tVault('settingsModal.profile.setPasswordSection')}</span>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setSetPasswordOpen(true)}
                disabled={busy || isRenamingProfile || isSettingPassword || profileHasPassword}
              >
                {tVault('settingsModal.profile.setPasswordAction')}
              </button>
            </div>
          </div>

          <div className="form-field" style={toggleRowStyle}>
            <span className="form-label settings-subheader">{tVault('settingsModal.profile.changePasswordSection')}</span>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setChangePasswordOpen(true)}
                disabled={busy || isRenamingProfile || isChangingPassword || !profileHasPassword}
              >
                {tVault('settingsModal.profile.changePasswordAction')}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="dialog-footer--split">
          <div className="dialog-footer-left">
            <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
              {tCommon('action.cancel')}
            </button>
          </div>

          <div className="dialog-footer-right">
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={busy || !settings || !canSave}>
              {tVault('backup.settings.save')}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={renameProfileOpen}
      onOpenChange={(nextOpen) => (!nextOpen ? setRenameProfileOpen(false) : undefined)}
    >
      <DialogContent aria-labelledby="rename-profile-title">
        <DialogHeader>
          <DialogTitle id="rename-profile-title">{tVault('settingsModal.profile.renameTitle')}</DialogTitle>
        </DialogHeader>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-field">
            <label className="form-label" htmlFor="rename-profile-input">
              {tVault('settingsModal.profile.nameLabel')}
            </label>
            <input
              id="rename-profile-input"
              type="text"
              value={renameProfileValue}
              disabled={busy || isRenamingProfile}
              onChange={(event) => setRenameProfileValue(event.target.value)}
              autoComplete="off"
              style={fullWidthInputStyle}
            />
          </div>
        </div>

        <DialogFooter className="dialog-footer--split">
          <div className="dialog-footer-left">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setRenameProfileOpen(false)}
              disabled={busy || isRenamingProfile}
            >
              {tCommon('action.cancel')}
            </button>
          </div>

          <div className="dialog-footer-right">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleRenameSave}
              disabled={busy || isRenamingProfile || !canSaveRename}
            >
              {tVault('backup.settings.save')}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={setPasswordOpen} onOpenChange={(nextOpen) => (!nextOpen ? setSetPasswordOpen(false) : undefined)}>
      <DialogContent aria-labelledby="set-password-title">
        <DialogHeader>
          <DialogTitle id="set-password-title">{tVault('settingsModal.profile.setPasswordTitle')}</DialogTitle>
        </DialogHeader>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-field">
            <label className="form-label" htmlFor="set-password-input">
              {tVault('settingsModal.profile.passwordLabel')}
            </label>
            <input
              id="set-password-input"
              type="password"
              value={setPasswordValue}
              disabled={busy || isSettingPassword || profileHasPassword}
              onChange={(e) => setSetPasswordValue(e.target.value)}
              autoComplete="new-password"
              style={fullWidthInputStyle}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="set-password-confirm-input">
              {tVault('settingsModal.profile.confirmPasswordLabel')}
            </label>
            <input
              id="set-password-confirm-input"
              type="password"
              value={setPasswordConfirm}
              disabled={busy || isSettingPassword || profileHasPassword}
              onChange={(e) => setSetPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              style={fullWidthInputStyle}
            />
          </div>
        </div>

        <DialogFooter className="dialog-footer--split">
          <div className="dialog-footer-left">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setSetPasswordOpen(false)}
              disabled={busy || isSettingPassword}
            >
              {tCommon('action.cancel')}
            </button>
          </div>

          <div className="dialog-footer-right">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleSetPasswordSave}
              disabled={busy || isSettingPassword || !canSaveSetPassword}
            >
              {tVault('backup.settings.save')}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={changePasswordOpen}
      onOpenChange={(nextOpen) => (!nextOpen ? setChangePasswordOpen(false) : undefined)}
    >
      <DialogContent aria-labelledby="change-password-title">
        <DialogHeader>
          <DialogTitle id="change-password-title">{tVault('settingsModal.profile.changePasswordTitle')}</DialogTitle>
        </DialogHeader>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-field">
            <label className="form-label" htmlFor="change-password-input">
              {tVault('settingsModal.profile.passwordLabel')}
            </label>
            <input
              id="change-password-input"
              type="password"
              value={changePasswordValue}
              disabled={busy || isChangingPassword || !profileHasPassword}
              onChange={(e) => setChangePasswordValue(e.target.value)}
              autoComplete="new-password"
              style={fullWidthInputStyle}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="change-password-confirm-input">
              {tVault('settingsModal.profile.confirmPasswordLabel')}
            </label>
            <input
              id="change-password-confirm-input"
              type="password"
              value={changePasswordConfirm}
              disabled={busy || isChangingPassword || !profileHasPassword}
              onChange={(e) => setChangePasswordConfirm(e.target.value)}
              autoComplete="new-password"
              style={fullWidthInputStyle}
            />
          </div>
        </div>

        <DialogFooter className="dialog-footer--split">
          <div className="dialog-footer-left">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setChangePasswordOpen(false)}
              disabled={busy || isChangingPassword}
            >
              {tCommon('action.cancel')}
            </button>
          </div>

          <div className="dialog-footer-right">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleChangePasswordSave}
              disabled={busy || isChangingPassword || !canSaveChangePassword}
            >
              {tVault('backup.settings.save')}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
