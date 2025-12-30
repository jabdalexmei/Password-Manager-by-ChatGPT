import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { IconFilters } from '../../../../shared/icons/lucide/icons';
import { VaultSearchFilterKey, VaultSearchFilters } from '../../types/searchFilters';

type Props = {
  query: string;
  onChange: (value: string) => void;
  filters: VaultSearchFilters;
  onChangeFilters: (next: VaultSearchFilters) => void;
  filterKeys: VaultSearchFilterKey[];
};

export function Search({ query, onChange, filters, onChangeFilters, filterKeys }: Props) {
  const { t } = useTranslation('Vault');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const labelByKey = useMemo<Record<VaultSearchFilterKey, string>>(
    () => ({
      has2fa: t('filters.has2fa'),
      hasAttachments: t('filters.hasAttachments'),
      hasSeedPhrase: t('filters.hasSeedPhrase'),
      hasPhone: t('filters.hasPhone'),
      hasNotes: t('filters.hasNotes'),
    }),
    [t]
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!rootRef.current) return;
      if (!rootRef.current.contains(target)) setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const toggle = (key: VaultSearchFilterKey) => {
    onChangeFilters({ ...filters, [key]: !filters[key] });
  };

  return (
    <div className="vault-searchbar" ref={rootRef}>
      <input
        type="search"
        className="vault-search"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        type="button"
        className="btn btn-secondary btn-icon vault-filter-button"
        aria-label={t('filters.button')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconFilters size={18} />
      </button>

      {open && (
        <div className="vault-filter-popover" role="dialog" aria-label={t('filters.title')}>
          <div className="vault-filter-popover-title">{t('filters.title')}</div>
          <div className="vault-filter-popover-grid">
            {filterKeys.map((key) => {
              const active = filters[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-compact vault-filter-toggle ${active ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={active}
                  onClick={() => toggle(key)}
                >
                  {labelByKey[key]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
