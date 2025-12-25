import React, { useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { BankCardItem } from '../../types/ui';
import { useBankCardDetails } from './useBankCardDetails';
import { IconCopy, IconPreview, IconPreviewOff } from '@/components/lucide/icons';
import ConfirmDialog from '../../../../components/ConfirmDialog';

export type BankCardDetailsProps = {
  card: BankCardItem | null;
  onEdit: (card: BankCardItem) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isTrashMode: boolean;
  clipboardClearTimeoutSeconds?: number;
};

const maskCardNumber = (value?: string | null) => {
  const trimmed = value?.replace(/\s+/g, '') ?? '';
  if (!trimmed) return '';
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
};

export function BankCardDetails({
  card,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
  onToggleFavorite,
  isTrashMode,
  clipboardClearTimeoutSeconds,
}: BankCardDetailsProps) {
  const { t } = useTranslation('BankCards');
  const { t: tVault } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
  const detailActions = useBankCardDetails({
    card,
    onDelete,
    onEdit,
    onRestore,
    onPurge,
    onToggleFavorite,
    isTrashMode,
    clipboardClearTimeoutSeconds,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  const informationTitle = <div className="vault-section-header">{tVault('information.title')}</div>;

  if (!card) {
    return (
      <div className="vault-panel-wrapper">
        {informationTitle}
        <div className="vault-empty">{t('label.selectPrompt')}</div>
      </div>
    );
  }

  const isFavorite = card.isFavorite;
  const createdText = `${t('label.created')}: ${new Date(card.createdAt).toLocaleString()}`;
  const updatedText = `${t('label.updated')}: ${new Date(card.updatedAt).toLocaleString()}`;
  const hasValue = (value?: string | null) => {
    const trimmed = value?.trim();
    return Boolean(trimmed);
  };
  const hasHolder = hasValue(card.holder);
  const hasNumber = hasValue(card.number);
  const hasCvc = hasValue(card.cvc);
  const hasNote = hasValue(card.note);
  const hasTags = Array.isArray(card.tags) && card.tags.length > 0;

  const numberDisplay = hasNumber
    ? detailActions.showNumber
      ? card.number
      : maskCardNumber(card.number)
    : '';
  const cvcDisplay = hasCvc
    ? detailActions.showCvc
      ? card.cvc
      : '•••'
    : tCommon('value.empty');

  const tagsText = card.tags?.join(', ') ?? '';

  return (
    <>
      <div className="vault-panel-wrapper">
        {informationTitle}
        <div className="vault-detail-card bankcard-detail-card">
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
                  <button className="btn btn-danger" type="button" onClick={() => setDeleteConfirmOpen(true)}>
                    {t('action.delete')}
                  </button>
                </>
              )}
              {isTrashMode && (
                <>
                  <button className="btn btn-secondary" type="button" onClick={detailActions.restoreCard}>
                    {t('action.restore')}
                  </button>
                  <button className="btn btn-danger" type="button" onClick={() => setPurgeConfirmOpen(true)}>
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

          {hasHolder && (
            <div className="detail-field">
              <div className="detail-label">{t('label.holder')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{card.holder ?? ''}</div>
              </div>
            </div>
          )}

          {hasNumber && (
            <div className="detail-field">
              <div className="detail-label">{t('label.number')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{numberDisplay}</div>
                <div className="detail-value-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.number, { isSecret: true })}
                  >
                    <IconCopy />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={detailActions.showNumber ? t('action.hide') : t('action.reveal')}
                    onClick={detailActions.toggleNumberVisibility}
                  >
                    {detailActions.showNumber ? <IconPreviewOff /> : <IconPreview />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bankcard-detail-grid">
            <div className="detail-field">
              <div className="detail-label">{t('label.expiry')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{card.expiryMmYy || tCommon('value.empty')}</div>
              </div>
            </div>

            <div className="detail-field">
              <div className="detail-label">{t('label.cvc')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text detail-value-text-monospace">{cvcDisplay}</div>
                <div className="detail-value-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.cvc, { isSecret: true })}
                  >
                    <IconCopy />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={detailActions.showCvc ? t('action.hide') : t('action.reveal')}
                    onClick={detailActions.toggleCvcVisibility}
                  >
                    {detailActions.showCvc ? <IconPreviewOff /> : <IconPreview />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {hasNote && (
            <div className="detail-field">
              <div className="detail-label">{t('label.note')}</div>
              <div className="detail-value-box detail-value-multiline">
                <div className="detail-value-text detail-value-text-multiline">{card.note ?? ''}</div>
                <div className="detail-value-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.note)}
                  >
                    <IconCopy />
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasTags && (
            <div className="detail-field">
              <div className="detail-label">{t('label.tags')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{tagsText}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('dialog.delete.title')}
        description={t('dialog.delete.message')}
        confirmLabel={t('dialog.delete.confirm')}
        cancelLabel={tCommon('action.cancel')}
        onConfirm={() => {
          detailActions.deleteCard();
          setDeleteConfirmOpen(false);
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
      <ConfirmDialog
        open={purgeConfirmOpen}
        title={t('dialog.purge.title')}
        description={t('dialog.purge.message')}
        confirmLabel={t('dialog.purge.confirm')}
        cancelLabel={tCommon('action.cancel')}
        onConfirm={() => {
          detailActions.purgeCard();
          setPurgeConfirmOpen(false);
        }}
        onCancel={() => setPurgeConfirmOpen(false)}
      />
    </>
  );
}
