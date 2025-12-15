import { TrashToggle } from '../Trash/TrashToggle';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  profileName: string;
  isTrashMode: boolean;
  onToggleTrash: (on: boolean) => void;
  onLock: () => void;
};

export function VaultHeader({ profileName, isTrashMode, onToggleTrash, onLock }: Props) {
  const { t } = useTranslation('Vault');

  return (
    <header className="vault-header">
      <div>
        <div className="vault-title">{t('title')}</div>
        <div className="vault-subtitle">{t('activeProfile', { profileName })}</div>
      </div>
      <div className="vault-header-actions">
        <TrashToggle isOn={isTrashMode} onToggle={onToggleTrash} />
        <button type="button" className="btn btn-danger" onClick={onLock}>
          {t('lock')}
        </button>
      </div>
    </header>
  );
}
