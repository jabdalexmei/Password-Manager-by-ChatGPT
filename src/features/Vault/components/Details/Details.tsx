import React, { useMemo } from 'react';
import { DataCard, Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useDetails } from './useDetails';

export type DetailsProps = {
  card: DataCard | null;
  folders: Folder[];
  onEdit: (card: DataCard) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export function Details({ card, folders, onEdit, onDelete, onToggleFavorite }: DetailsProps) {
  const { t } = useTranslation('DataCards');
  const detailActions = useDetails({ card, onDelete, onEdit, onToggleFavorite });

  const folderName = useMemo(() => {
    if (!card) return '';
    return card.folderId ? folders.find((f) => f.id === card.folderId)?.name ?? t('label.noFolder') : t('label.noFolder');
  }, [card, folders, t]);

  if (!card) {
    return <div className="vault-empty">{t('label.selectPrompt')}</div>;
  }

  const isFavorite = card.tags?.includes('favorite');
  const createdText = `${t('label.created')}: ${new Date(card.createdAt).toLocaleString()}`;
  const updatedText = `${t('label.updated')}: ${new Date(card.updatedAt).toLocaleString()}`;
  const passwordDisplay = card.password ? (detailActions.showPassword ? card.password : '••••••••') : t('label.noValue');

  return (
    <div className="vault-detail-card">
      <div className="detail-row">
        <div className="detail-dates">
          <div className="muted">{createdText}</div>
          <div className="muted">{updatedText}</div>
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary" type="button" onClick={detailActions.toggleFavorite}>
            {isFavorite ? t('action.unmarkFavorite') : t('action.markFavorite')}
          </button>
          <button className="btn btn-secondary" type="button" onClick={detailActions.editCard}>
            {t('action.edit')}
          </button>
          <button className="btn btn-danger" type="button" onClick={detailActions.deleteCard}>
            {t('action.delete')}
          </button>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.title')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.title}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.folder')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{folderName}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.username')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.username || t('label.noValue')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.email')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.email || t('label.noValue')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.url')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.url || t('label.noValue')}</div>
          <div className="detail-value-actions">
            <button
              className="icon-button"
              type="button"
              aria-label={t('action.copy')}
              onClick={() => detailActions.copyToClipboard(card.url)}
            >
              ⧉
            </button>
          </div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.mobile')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.mobilePhone || t('label.noValue')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.password')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{passwordDisplay}</div>
          <div className="detail-value-actions">
            <button
              className="icon-button"
              type="button"
              aria-label={t('action.copy')}
              onClick={() => detailActions.copyToClipboard(card.password, true)}
            >
              ⧉
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={detailActions.showPassword ? t('action.hide') : t('action.reveal')}
              onClick={detailActions.togglePasswordVisibility}
            >
              👁
            </button>
          </div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.note')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.note || t('label.noValue')}</div>
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.tags')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.tags && card.tags.length > 0 ? card.tags.join(', ') : t('label.noValue')}</div>
        </div>
      </div>
    </div>
  );
}
