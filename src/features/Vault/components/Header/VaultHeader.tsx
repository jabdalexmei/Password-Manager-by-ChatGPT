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
  const { t: tCommon } = useTranslation('Common');
  const lockLabel = isPasswordless ? t('logout') : t('lock');

  return (
    <header className="vault-appbar">
      <div className="vault-profile">
        <div className="vault-title">{t('title')}</div>
        <div className="vault-subtitle">{t('active_profile', { name: profileName, id: profileId })}</div>
      </div>

      <div className="vault-actions">
        <button
          type="button"
          className="vault-header__icon-button"
          onClick={onExportBackup}
          aria-label={tCommon('backup.export')}
          title={tCommon('backup.export')}
        >
          <IconDownload />
        </button>
        <button
          type="button"
          className="vault-header__icon-button"
          onClick={onImportBackup}
          aria-label={tCommon('backup.import')}
          title={tCommon('backup.import')}
        >
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
