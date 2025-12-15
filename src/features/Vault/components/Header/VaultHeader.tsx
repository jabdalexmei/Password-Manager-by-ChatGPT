import React from 'react';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  profileName: string;
  onLock: () => void;
};

const IconButton = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export function VaultHeader({ profileName, onLock }: Props) {
  const { t } = useTranslation('Vault');

  return (
    <header className="vault-appbar">
      <div className="vault-profile">
        <div className="vault-title">{t('title')}</div>
        <div className="vault-subtitle">{t('activeProfile', { profileName })}</div>
      </div>

      <div className="vault-actions">
        <button className="vault-action-button" type="button" aria-label={t('export')} disabled>
          <IconButton>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m16 11-4 4-4-4" />
              <path d="M4 17h16v4H4z" />
            </svg>
          </IconButton>
        </button>
        <button className="vault-action-button" type="button" aria-label={t('import')} disabled>
          <IconButton>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V9" />
              <path d="m8 13 4-4 4 4" />
              <path d="M4 3h16v4H4z" />
            </svg>
          </IconButton>
        </button>
        <button className="vault-action-button" type="button" aria-label={t('settings')} disabled>
          <IconButton>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.4 1.31 1.01 1.58.63.28 1.37.13 1.87-.37" />
            </svg>
          </IconButton>
        </button>
        <button className="vault-action-button" type="button" aria-label={t('lock')} onClick={onLock}>
          <IconButton>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </IconButton>
        </button>
      </div>
    </header>
  );
}
