import React from 'react';
import { DataCard } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';

export type DataCardsProps = {
  cards: DataCard[];
  isTrashMode: boolean;
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
  onAddCard: () => void;
  onDeleteCard: (id: string) => void;
  onRestoreCard: (id: string) => void;
  onPurgeCard: (id: string) => void;
};

export function DataCards({
  cards,
  isTrashMode,
  selectedCardId,
  onSelectCard,
  onAddCard,
  onDeleteCard,
  onRestoreCard,
  onPurgeCard,
}: DataCardsProps) {
  const { t } = useTranslation('Vault');

  return (
    <div className="vault-panel">
      <div className="vault-panel-header">
        <span>{t('dataCardsTitle')}</span>
        {!isTrashMode && (
          <button className="btn btn-primary" type="button" onClick={onAddCard}>
            {t('addDataCard')}
          </button>
        )}
      </div>
      {cards.length === 0 ? (
        <div className="vault-empty">{t('emptyState')}</div>
      ) : (
        <ul className="vault-card-list">
          {cards.map((card) => (
            <li key={card.id} className={selectedCardId === card.id ? 'active' : ''}>
              <div className="vault-card" onClick={() => onSelectCard(card.id)} role="button" tabIndex={0}>
                <div className="vault-card-title">{card.title}</div>
                <div className="vault-card-meta">
                  <span>{card.username || card.email || card.url || t('noMeta')}</span>
                  <span className="muted">{t('updated', { value: new Date(card.updatedAt).toLocaleString() })}</span>
                </div>
              </div>
              {!isTrashMode && (
                <button className="btn btn-danger" type="button" onClick={() => onDeleteCard(card.id)}>
                  {t('delete')}
                </button>
              )}
              {isTrashMode && (
                <div className="vault-card-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => onRestoreCard(card.id)}>
                    {t('restore')}
                  </button>
                  <button className="btn btn-danger" type="button" onClick={() => onPurgeCard(card.id)}>
                    {t('purge')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
