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
    <div className="vault-panel-wrapper">
      <div className="datacards-header">
        <div className="vault-section-header">{t('entriesTitle')}</div>
        {!isTrashMode && (
          <button className="btn btn-primary" type="button" onClick={onAddCard}>
            {t('addEntry')}
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="vault-empty">{t('emptyState')}</div>
      ) : (
        <div className="vault-datacard-list">
          {cards.map((card) => {
            const isActive = selectedCardId === card.id;
            const isFavorite = card.tags?.includes('favorite');
            const meta = card.username || card.email || card.url || t('noMeta');

            return (
              <div key={card.id} className={isActive ? 'active' : ''}>
                <button className={`vault-datacard ${isActive ? 'active' : ''}`} type="button" onClick={() => onSelectCard(card.id)}>
                  <div className="datacard-title">{card.title}</div>
                  <div className="datacard-meta">
                    <span>{meta}</span>
                    <div>
                      {isFavorite && <span className="pill">{t('favorite')}</span>}
                      <span className="muted">{t('updated', { value: new Date(card.updatedAt).toLocaleString() })}</span>
                    </div>
                  </div>
                </button>
                {isTrashMode ? (
                  <div className="vault-card-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => onRestoreCard(card.id)}>
                      {t('restore')}
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => onPurgeCard(card.id)}>
                      {t('purge')}
                    </button>
                  </div>
                ) : (
                  <div className="vault-card-actions">
                    <button className="btn btn-danger" type="button" onClick={() => onDeleteCard(card.id)}>
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
