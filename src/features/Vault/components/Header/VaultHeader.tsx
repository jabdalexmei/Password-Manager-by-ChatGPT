import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconDownload, IconImport, IconLock, IconSettings } from '@/components/lucide/icons';
import { useTranslation } from '../../../../lib/i18n';
import ExportBackupDialog from '../modals/ExportBackupDialog';
import ImportBackupDialog from '../modals/ImportBackupDialog';
import { getSettings, exportBackup, updateSettings, decryptBackupToTemp, finalizeImportAsNewProfile, finalizeRestore } from '../../api/vaultApi';
import { BackendUserSettings } from '../../types/backend';
import { useToaster } from '@/components/Toaster';
import { open, save } from '@tauri-apps/plugin-dialog';

type Props = {
  profileName: string;
  profileId: string;
  onLock: () => void;
};

export function VaultHeader({ profileName, profileId, onLock }: Props) {
  const { t } = useTranslation('Vault');
  const { show: showToast } = useToaster();
  const [settings, setSettings] = useState<BackendUserSettings | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPath, setImportPath] = useState('');

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const defaultExportPath = useMemo(() => settings?.default_export_dir ?? settings?.last_export_dir, [settings]);

  const handleExport = useCallback(
    async (options: { mode: 'profile' | 'custom'; customPassword?: string; rememberPath: boolean }) => {
      const defaultPath = options.rememberPath ? defaultExportPath ?? undefined : undefined;
      const targetPath = await save({
        defaultPath,
        filters: [{ name: 'Backups', extensions: ['zip'] }],
      });

      if (!targetPath) return;

      try {
        await exportBackup(targetPath, options.mode, options.customPassword);
        showToast('Backup exported', 'success');

        if (options.rememberPath && settings) {
          const updated = { ...settings, last_export_dir: targetPath };
          setSettings(updated);
          await updateSettings(updated);
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to export backup', 'error');
      } finally {
        setExportOpen(false);
      }
    },
    [defaultExportPath, settings, showToast]
  );

  const pickImportFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Backups', extensions: ['zip'] }],
    });

    if (typeof selected === 'string') {
      setImportPath(selected);
      setImportOpen(true);
    }
  };

  const handleRestore = useCallback(
    async (password: string) => {
      if (!importPath) return;
      const tempId = await decryptBackupToTemp(importPath, password);
      await finalizeRestore(tempId);
      showToast('Backup restored', 'success');
      setImportOpen(false);
    },
    [importPath, showToast]
  );

  const handleImportNewProfile = useCallback(
    async (password: string, profileName: string) => {
      if (!importPath) return;
      const tempId = await decryptBackupToTemp(importPath, password);
      await finalizeImportAsNewProfile(tempId, profileName, password);
      showToast('Backup imported as new profile', 'success');
      setImportOpen(false);
    },
    [importPath, showToast]
  );

  return (
    <header className="vault-appbar">
      <div className="vault-profile">
        <div className="vault-title">{t('title')}</div>
        <div className="vault-subtitle">{t('active_profile', { name: profileName, id: profileId })}</div>
      </div>

      <div className="vault-actions">
        <button
          className="vault-action-button"
          type="button"
          aria-label={t('export')}
          onClick={() => setExportOpen(true)}
        >
          <IconDownload />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('import')} onClick={() => void pickImportFile()}>
          <IconImport />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('settings')} disabled>
          <IconSettings />
        </button>
        <button className="vault-action-button" type="button" aria-label={t('lock')} onClick={onLock}>
          <IconLock />
        </button>
      </div>

      <ExportBackupDialog
        open={exportOpen}
        defaultDir={settings?.default_export_dir ?? undefined}
        lastDir={settings?.last_export_dir ?? undefined}
        onConfirm={handleExport}
        onClose={() => setExportOpen(false)}
      />

      <ImportBackupDialog
        open={importOpen}
        backupPath={importPath}
        restoreEnabled
        onRestore={handleRestore}
        onImportNew={handleImportNewProfile}
        onClose={() => setImportOpen(false)}
      />
    </header>
  );
}
