import React, { useMemo, useState } from 'react';
import { IconDownload } from '@/components/lucide/icons';

type ExportBackupDialogProps = {
  open: boolean;
  defaultDir?: string | null;
  lastDir?: string | null;
  onConfirm: (options: {
    mode: 'profile' | 'custom';
    customPassword?: string;
    rememberPath: boolean;
  }) => Promise<void>;
  onClose: () => void;
};

const ExportBackupDialog: React.FC<ExportBackupDialogProps> = ({
  open,
  defaultDir,
  lastDir,
  onConfirm,
  onClose,
}) => {
  const [mode, setMode] = useState<'profile' | 'custom'>('profile');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberPath, setRememberPath] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = useMemo(() => {
    if (mode === 'custom' && (!password.trim() || !confirmPassword.trim())) {
      return 'Password required';
    }
    if (mode === 'custom' && password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }, [confirmPassword, mode, password]);

  const handleConfirm = async () => {
    if (validationError) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        mode,
        customPassword: mode === 'custom' ? password : undefined,
        rememberPath,
      });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setError('Failed to start backup');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="export-backup-title">
        <div className="dialog-header">
          <h2 id="export-backup-title" className="dialog-title">
            <IconDownload />
            <span>Export backup</span>
          </h2>
          <div className="muted text-small">{defaultDir || lastDir ? 'A default export folder is available.' : null}</div>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label className="form-label">Backup password</label>
            <div className="radio-group">
              <label className="radio">
                <input
                  type="radio"
                  name="backup-password-mode"
                  value="profile"
                  checked={mode === 'profile'}
                  onChange={() => setMode('profile')}
                />
                <span>Use profile password</span>
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="backup-password-mode"
                  value="custom"
                  checked={mode === 'custom'}
                  onChange={() => setMode('custom')}
                />
                <span>Use custom backup password</span>
              </label>
            </div>
          </div>

          {mode === 'custom' ? (
            <div className="grid gap-2">
              <div className="form-group">
                <label className="form-label" htmlFor="backup-password">
                  Password
                </label>
                <input
                  id="backup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="backup-password-confirm">
                  Confirm password
                </label>
                <input
                  id="backup-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {validationError ? <div className="error-text">{validationError}</div> : null}
            </div>
          ) : null}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={rememberPath}
              onChange={(e) => setRememberPath(e.target.checked)}
            />
            <span>Remember export folder</span>
          </label>

          {error ? <div className="error-text">{error}</div> : null}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || !!validationError}
          >
            Save…
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportBackupDialog;
