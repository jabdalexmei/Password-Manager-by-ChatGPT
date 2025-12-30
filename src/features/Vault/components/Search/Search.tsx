import React from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { IconSliders } from '../../../../shared/icons/lucide';
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
  const hasFilters = filterKeys.length > 0;

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);

  const desiredOrder: VaultSearchFilterKey[] = React.useMemo(
    () => ['has2fa', 'hasSeedPhrase', 'hasPhone', 'hasNotes', 'hasAttachments'],
    []
  );

  const orderedKeys = React.useMemo(() => {
    const allowed = new Set(filterKeys);
    return desiredOrder.filter((key) => allowed.has(key));
  }, [desiredOrder, filterKeys]);

  const labelFor = React.useCallback(
    (key: VaultSearchFilterKey) => {
      switch (key) {
        case 'has2fa':
          return t('filters.2fa');
        case 'hasSeedPhrase':
          return t('filters.seedPhrase');
        case 'hasPhone':
          return t('filters.phone');
        case 'hasNotes':
          return t('filters.notes');
        case 'hasAttachments':
          return t('filters.attachments');
        default:
          return key;
      }
    },
    [t]
  );

  const toggle = React.useCallback(
    (key: VaultSearchFilterKey) => {
      onChangeFilters({ ...filters, [key]: !filters[key] });
    },
    [filters, onChangeFilters]
  );

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="vault-search-row" ref={rootRef}>
      <input
        type="search"
        className="vault-search"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />

      {hasFilters && (
        <button
          type="button"
          className="vault-filter-trigger"
          aria-label={t('filters.open')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <IconSliders />
        </button>
      )}

      {hasFilters && open && (
        <div className="vault-filter-popover" role="dialog" aria-label={t('filters.title')}>
          <div className="vault-filter-list">
            {orderedKeys.map((key) => {
              const active = !!filters[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`vault-filter-chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => toggle(key)}
                >
                  {labelFor(key)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
