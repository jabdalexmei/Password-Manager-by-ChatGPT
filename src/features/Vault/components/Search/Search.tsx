import React from 'react';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  query: string;
  onChange: (value: string) => void;
};

export function Search({ query, onChange }: Props) {
  const { t } = useTranslation('Search');

  return (
    <input
      type="search"
      className="vault-search"
      placeholder={t('placeholder.searchVault')}
      value={query}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
