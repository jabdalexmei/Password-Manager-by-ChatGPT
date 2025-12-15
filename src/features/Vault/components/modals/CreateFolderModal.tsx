import React, { useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function CreateFolderModal({ isOpen, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const { t } = useTranslation('Vault');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{t('createFolderTitle')}</h3>
        <label>
          {t('nameLabel')}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              if (!name.trim()) return;
              onSubmit(name.trim());
              setName('');
              onClose();
            }}
          >
            {t('create')}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
