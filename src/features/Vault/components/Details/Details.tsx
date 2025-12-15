import React from 'react';
import { DataCard, Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';

export type DetailsProps = {
  card: DataCard | null;
  folders: Folder[];
  onEdit: (card: DataCard) => void;
  onDelete: (id: string) => void;
};

export function Details({ card, folders, onEdit, onDelete }: DetailsProps) {
  const { t } = useTranslation('Vault');

  if (!card) {
    return <div className="vault-empty">{t('selectPrompt')}</div>;
  }

  const folderName = card.folderId ? folders.find((f) => f.id === card.folderId)?.name : t('noFolder');

  return (
    <div className="vault-details-card">
      <div className="vault-panel-header">
        <span>{t('detailsTitle')}</span>
        <div className="vault-detail-actions">
          <button className="btn btn-secondary" type="button" onClick={() => onEdit(card)}>
            {t('edit')}
          </button>
          <button className="btn btn-danger" type="button" onClick={() => onDelete(card.id)}>
            {t('delete')}
          </button>
        </div>
      </div>
      <dl className="vault-detail-grid">
        <dt>{t('titleLabel')}</dt>
        <dd>{card.title}</dd>
        <dt>{t('folderLabel')}</dt>
        <dd>{folderName}</dd>
        <dt>{t('username')}</dt>
        <dd>{card.username || t('notAvailable')}</dd>
        <dt>{t('email')}</dt>
        <dd>{card.email || t('notAvailable')}</dd>
        <dt>{t('url')}</dt>
        <dd>{card.url || t('notAvailable')}</dd>
        <dt>{t('mobile')}</dt>
        <dd>{card.mobilePhone || t('notAvailable')}</dd>
        <dt>{t('password')}</dt>
        <dd>{card.password || t('notAvailable')}</dd>
        <dt>{t('note')}</dt>
        <dd>{card.note || t('notAvailable')}</dd>
        <dt>{t('tags')}</dt>
        <dd>{card.tags && card.tags.length > 0 ? card.tags.join(', ') : t('notAvailable')}</dd>
      </dl>
    </div>
  );
}
