import React, { useMemo } from 'react';
import { DataCard, Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useDetails } from './useDetails';

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3 21 21" />
    <path d="M10.7 10.7a3 3 0 1 0 4.6 4.6" />
    <path d="M9.53 5.11A10.46 10.46 0 0 1 12 5c7 0 11 7 11 7a16.48 16.48 0 0 1-2.06 2.88" />
    <path d="M6.61 6.61C3.93 8.28 2 12 2 12a16.54 16.54 0 0 0 5.11 5.11" />
  </svg>
);

export type DetailsProps = {
  card: DataCard | null;
  folders: Folder[];
  onEdit: (card: DataCard) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isTrashMode: boolean;
  clipboardClearTimeoutSeconds?: number;
};

export function Details({
  card,
  folders,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
  onToggleFavorite,
  isTrashMode,
  clipboardClearTimeoutSeconds,
}: DetailsProps) {
  const { t } = useTranslation('Details');
  const detailActions = useDetails({
    card,
    onDelete,
    onEdit,
    onRestore,
    onPurge,
    onToggleFavorite,
    isTrashMode,
    clipboardClearTimeoutSeconds,
  });

  const folderName = useMemo(() => {
    if (!card) return '';
    return card.folderId ? folders.find((f) => f.id === card.folderId)?.name ?? t('label.noFolder') : t('label.noFolder');
  }, [card, folders, t]);

  if (!card) {
    return <div className="vault-empty">{t('empty.selectPrompt')}</div>;
  }

  const isFavorite = card.tags?.includes('favorite');
  const createdText = `${t('label.created')}: ${new Date(card.createdAt).toLocaleString()}`;
  const updatedText = `${t('label.updated')}: ${new Date(card.updatedAt).toLocaleString()}`;
  const hasValue = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return false;
    return trimmed !== t('label.noValue');
  };
  const hasUrl = hasValue(card.url);
  const hasUsername = hasValue(card.username);
  const hasEmail = hasValue(card.email);
  const hasMobile = hasValue(card.mobilePhone);
  const hasPassword = hasValue(card.password);
  const hasNote = hasValue(card.note);
  const passwordDisplay = hasPassword
    ? detailActions.showPassword
      ? card.password
      : '••••••••••••'
    : t('label.noValue');

  return (
    <div className="vault-detail-card">
      <div className="detail-row">
        <div className="detail-dates">
          <div className="muted">{createdText}</div>
          <div className="muted">{updatedText}</div>
        </div>
        <div className="detail-actions">
          {!isTrashMode && (
            <>
              <button className="btn btn-secondary" type="button" onClick={detailActions.toggleFavorite}>
                {isFavorite ? t('action.unmarkFavorite') : t('action.markFavorite')}
              </button>
              <button className="btn btn-secondary" type="button" onClick={detailActions.editCard}>
                {t('action.edit')}
              </button>
              <button className="btn btn-danger" type="button" onClick={detailActions.deleteCard}>
                {t('action.delete')}
              </button>
            </>
          )}
          {isTrashMode && (
            <>
              <button className="btn btn-secondary" type="button" onClick={detailActions.restoreCard}>
                {t('action.restore')}
              </button>
              <button className="btn btn-danger" type="button" onClick={detailActions.purgeCard}>
                {t('action.purge')}
              </button>
            </>
          )}
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
          {hasUsername && (
            <div className="detail-value-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => detailActions.copyToClipboard(card.username)}
              >
                <CopyIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.email')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.email || t('label.noValue')}</div>
          {hasEmail && (
            <div className="detail-value-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => detailActions.copyToClipboard(card.email)}
              >
                <CopyIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.url')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.url || t('label.noValue')}</div>
          {hasUrl && (
            <div className="detail-value-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => detailActions.copyToClipboard(card.url)}
              >
                <CopyIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.mobile')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{card.mobilePhone || t('label.noValue')}</div>
          {hasMobile && (
            <div className="detail-value-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => detailActions.copyToClipboard(card.mobilePhone)}
              >
                <CopyIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.password')}</div>
        <div className="detail-value-box">
          <div className="detail-value-text">{passwordDisplay}</div>
          {hasPassword && (
            <div className="detail-value-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => detailActions.copyToClipboard(card.password, { isSecret: true })}
              >
                <CopyIcon />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={detailActions.showPassword ? t('action.hide') : t('action.reveal')}
                onClick={detailActions.togglePasswordVisibility}
              >
                {detailActions.showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-field">
        <div className="detail-label">{t('label.note')}</div>
        <div className="detail-value-box detail-value-multiline">
          <div className="detail-value-text detail-value-text-multiline">{card.note || t('label.noValue')}</div>
          {hasNote && (
            <div className="detail-value-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => detailActions.copyToClipboard(card.note)}
              >
                <CopyIcon />
              </button>
            </div>
          )}
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
