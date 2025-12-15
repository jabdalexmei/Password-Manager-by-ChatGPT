import { TrashToggle } from '../Trash/TrashToggle';

type Props = {
  profileName: string;
  isTrashMode: boolean;
  onToggleTrash: (on: boolean) => void;
  onLock: () => void;
};

export function VaultHeader({ profileName, isTrashMode, onToggleTrash, onLock }: Props) {
  return (
    <header className="vault-header">
      <div>
        <div className="vault-title">Password Manager</div>
        <div className="vault-subtitle">Active profile: {profileName}</div>
      </div>
      <div className="vault-header-actions">
        <TrashToggle isOn={isTrashMode} onToggle={onToggleTrash} />
        <button type="button" className="btn btn-danger" onClick={onLock}>
          Lock
        </button>
      </div>
    </header>
  );
}
