import React from 'react';
import { IconDownload, IconImport, IconLock, IconSettings } from '@/components/lucide/icons';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  profileName: string;
  profileId: string;
  isPasswordless: boolean;
  onLock: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenSettings: () => void;
};

export function VaultHeader({
  profileName,
  profileId,
  isPasswordless,
  onLock,
  onExportBackup,
  onImportBackup,
  onOpenSettings,
}: Props) {
  const { t } = useTranslation('Vault');
  const lockLabel = isPasswordless ? t('logout') : t('lock');

  return (
    <header className="vault-appbar">
      <div className="vault-profile">
        <div className="vault-title">{t('title')}</div>
        <div className="vault-subtitle">{t('active_profile', { name: profileName, id: profileId })}</div>
      </div>

      <div className="vault-actions">
        <button className="vault-action-button" type="button" aria-label={t('export')} onClick={onExportBackup}>
          <IconDownload />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('import')} onClick={onImportBackup}>
          <IconImport />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('settings')} onClick={onOpenSettings}>
          <IconSettings />
        </button>
        <button className="vault-action-button" type="button" aria-label={lockLabel} title={lockLabel} onClick={onLock}>
          <IconLock />
        </button>
      </div>
    </header>
  );
}
