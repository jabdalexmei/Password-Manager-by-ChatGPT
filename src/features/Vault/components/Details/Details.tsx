import React from 'react';
import { DataCard, Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';

export type DetailsProps = {
  card: DataCard | null;
  folders: Folder[];
  onEdit: (card: DataCard) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export function Details({ card, folders, onEdit, onDelete, onToggleFavorite }: DetailsProps) {
  const { t } = useTranslation('Vault');

  if (!card) {
    return <div className="vault-empty">{t('selectPrompt')}</div>;
  }

  const folderName = card.folderId ? folders.find((f) => f.id === card.folderId)?.name : t('noFolder');
  const isFavorite = card.tags?.includes('favorite');

  return (
    <div className="vault-detail-card">
      <div className="detail-row">
        <div className="detail-dates">
          <div className="muted">{t('created', { value: new Date(card.createdAt).toLocaleString() })}</div>
          <div className="muted">{t('updated', { value: new Date(card.updatedAt).toLocaleString() })}</div>
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary" type="button" onClick={() => onToggleFavorite(card.id)}>
            {isFavorite ? t('unmarkFavorite') : t('markFavorite')}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => onEdit(card)}>
            {t('edit')}
          </button>
          <button className="btn btn-danger" type="button" onClick={() => onDelete(card.id)}>
            {t('delete')}
          </button>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('titleLabel')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.title}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('folderLabel')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{folderName}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('username')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.username || t('notAvailable')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('email')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.email || t('notAvailable')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('url')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.url || t('notAvailable')}</div>
          <div className="detail-value-actions">
            <button className="icon-button" type="button" aria-label={t('copy')}>
              ⧉
            </button>
          </div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('mobile')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.mobilePhone || t('notAvailable')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('password')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.password || t('notAvailable')}</div>
          <div className="detail-value-actions">
            <button className="icon-button" type="button" aria-label={t('copy')}>
              ⧉
            </button>
            <button className="icon-button" type="button" aria-label={t('reveal')}>
              👁
            </button>
          </div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('note')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.note || t('notAvailable')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('tags')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.tags && card.tags.length > 0 ? card.tags.join(', ') : t('notAvailable')}</div>
        </div>
      </div>
    </div>
  );
}
