import React from 'react';
import { DataCard } from '../../types/ui';

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
  return (
    <div className="vault-panel">
      <div className="vault-panel-header">
        <span>Data Cards</span>
        {!isTrashMode && (
          <button className="btn btn-primary" type="button" onClick={onAddCard}>
            Add Data Card
          </button>
        )}
      </div>
      {cards.length === 0 ? (
        <div className="vault-empty">Empty</div>
      ) : (
        <ul className="vault-card-list">
          {cards.map((card) => (
            <li key={card.id} className={selectedCardId === card.id ? 'active' : ''}>
              <div className="vault-card" onClick={() => onSelectCard(card.id)} role="button" tabIndex={0}>
                <div className="vault-card-title">{card.title}</div>
                <div className="vault-card-meta">
                  <span>{card.username || card.email || card.url || 'No meta'}</span>
                  <span className="muted">Updated {new Date(card.updatedAt).toLocaleString()}</span>
                </div>
              </div>
              {!isTrashMode && (
                <button className="btn btn-danger" type="button" onClick={() => onDeleteCard(card.id)}>
                  Delete
                </button>
              )}
              {isTrashMode && (
                <div className="vault-card-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => onRestoreCard(card.id)}>
                    Restore
                  </button>
                  <button className="btn btn-danger" type="button" onClick={() => onPurgeCard(card.id)}>
                    Purge
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
