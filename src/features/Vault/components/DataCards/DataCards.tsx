import React from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { DataCardsViewModel } from './useDataCards';

export type DataCardsProps = {
  viewModel: DataCardsViewModel;
};

export function DataCards({ viewModel }: DataCardsProps) {
  const { t } = useTranslation('DataCards');
  const { cards, selectedCardId } = viewModel;

  return (
    <div className="vault-panel-wrapper">
      <div className="datacards-header">
        <div className="vault-section-header">{t('label.dataCardsTitle')}</div>
        <button className="btn btn-primary" type="button" onClick={viewModel.openCreateModal}>
          {t('label.addDataCard')}
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="vault-empty">{t('label.empty')}</div>
      ) : (
        <div className="vault-datacard-list">
          {cards.map((card) => {
            const isActive = selectedCardId === card.id;
            const isFavorite = card.tags?.includes('favorite');
            const meta = card.username || card.email || card.url || t('label.noMeta');
            const updatedText = `${t('label.updated')}: ${new Date(card.updatedAt).toLocaleString()}`;

            return (
              <button
                key={card.id}
                className={`vault-datacard ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => viewModel.selectCard(card.id)}
              >
                <div className="datacard-title">{card.title}</div>
                <div className="datacard-meta">
                  <span>{meta}</span>
                  <div>
                    {isFavorite && <span className="pill">{t('label.favorite')}</span>}
                    <span className="muted">{updatedText}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {viewModel.dialogs}
    </div>
  );
}
