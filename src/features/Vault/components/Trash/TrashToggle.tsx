import React from 'react';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  isOn: boolean;
  onToggle: (on: boolean) => void;
};

export function TrashToggle({ isOn, onToggle }: Props) {
  const { t } = useTranslation('Vault');

  return (
    <label className="trash-toggle">
      <input type="checkbox" checked={isOn} onChange={(e) => onToggle(e.target.checked)} />
      <span>{t('trashMode')}</span>
    </label>
  );
}
