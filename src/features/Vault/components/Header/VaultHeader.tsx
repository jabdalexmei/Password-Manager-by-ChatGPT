import React from 'react';
import { IconDownload, IconImport, IconLock, IconSettings } from '@/components/lucide/icons';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  profileName: string;
  profileId: string;
  onLock: () => void;
};

export function VaultHeader({ profileName, profileId, onLock }: Props) {
  const { t } = useTranslation('Vault');

  return (
    <header className="vault-appbar">
      <div className="vault-profile">
        <div className="vault-title">{t('title')}</div>
        <div className="vault-subtitle">{t('active_profile', { name: profileName, id: profileId })}</div>
      </div>

      <div className="vault-actions">
        <button className="vault-action-button" type="button" aria-label={t('export')} disabled>
          <IconDownload />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('import')} disabled>
          <IconImport />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('settings')} disabled>
          <IconSettings />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('lock')} onClick={onLock}>
          <IconLock />
        </button>
      </div>
    </header>
  );
}
