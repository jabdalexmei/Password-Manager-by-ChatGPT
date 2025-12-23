import React, { useState } from 'react';
import { IconImport } from '@/components/lucide/icons';

type ImportBackupDialogProps = {
  open: boolean;
  backupPath: string;
  restoreEnabled: boolean;
  onRestore: (password: string) => Promise<void>;
  onImportNew: (password: string, profileName: string) => Promise<void>;
  onClose: () => void;
};

const ImportBackupDialog: React.FC<ImportBackupDialogProps> = ({
  open,
  backupPath,
  restoreEnabled,
  onRestore,
  onImportNew,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [profileName, setProfileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onRestore(password);
    } catch (err) {
      console.error(err);
      setError('Failed to restore backup');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportNew = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onImportNew(password, profileName);
    } catch (err) {
      console.error(err);
      setError('Failed to import backup');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="import-backup-title">
        <div className="dialog-header">
          <h2 id="import-backup-title" className="dialog-title">
            <IconImport />
            <span>Import backup</span>
          </h2>
          <div className="muted text-small">{backupPath}</div>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label className="form-label" htmlFor="backup-password-input">
              Backup password
            </label>
            <input
              id="backup-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-profile-name">
              New profile name (for import-as-new)
            </label>
            <input
              id="new-profile-name"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="My imported profile"
            />
          </div>

          {!restoreEnabled ? (
            <div className="muted text-small">Restore is available only when the profile is unlocked.</div>
          ) : null}

          {error ? <div className="error-text">{error}</div> : null}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void handleImportNew()}
            disabled={!password || !profileName || submitting}
          >
            Import as new profile
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void handleRestore()}
            disabled={!restoreEnabled || !password || submitting}
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportBackupDialog;
