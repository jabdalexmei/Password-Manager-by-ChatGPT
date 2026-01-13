import React, { useState } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { BankCardItem } from '../../types/ui';
import { useBankCardDetails } from './useBankCardDetails';
import { IconCopy, IconPreview, IconPreviewOff } from '@/shared/icons/lucide/icons';
import ConfirmDialog from '../../../../shared/components/ConfirmDialog';
import { wasActuallyUpdated } from '../../utils/updatedAt';

export type BankCardDetailsProps = {
  card: BankCardItem | null;
  onEdit: (card: BankCardItem) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isTrashMode: boolean;
  clipboardAutoClearEnabled?: boolean;
  clipboardClearTimeoutSeconds?: number;
};

const maskCardNumber = (value?: string | null) => {
  const trimmed = value?.replace(/\s+/g, '') ?? '';
  if (!trimmed) return '';
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
};

const maskHolder = (value?: string | null) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  // Intentionally avoid leaking length; keep the UI consistently “sealed” by default.
  return '••••••';
};

export function BankCardDetails({
  card,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
  onToggleFavorite,
  isTrashMode,
  clipboardAutoClearEnabled,
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
    clipboardAutoClearEnabled,
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
  const showUpdated = wasActuallyUpdated(card.createdAt, card.updatedAt);
  const updatedText = showUpdated ? `${t('label.updated')}: ${new Date(card.updatedAt).toLocaleString()}` : '';
  const hasValue = (value?: string | null) => {
    const trimmed = value?.trim();
    return Boolean(trimmed);
  };
  const hasHolder = hasValue(card.holder);
  const hasNumber = hasValue(card.number);
  const hasExpiry = hasValue(card.expiryMmYy);
  const hasCvc = hasValue(card.cvc);
  const hasNote = hasValue(card.note);
  const hasTitle = hasValue(card.title);
  const hasBankName = hasValue(card.bankName);
  const title = card.title?.trim() ?? '';
  const hasTags = Array.isArray(card.tags) && card.tags.length > 0;
  const { showHolder, showNumber, showCvc } = detailActions;

  const holderDisplay = hasHolder ? (showHolder ? card.holder ?? '' : maskHolder(card.holder)) : '';

  const numberDisplay = hasNumber
    ? showNumber
      ? card.number
      : maskCardNumber(card.number)
    : '';
  const maskedCvc = card.cvc ? (card.cvc.length >= 4 ? '••••' : '•••') : '';
  const cvcDisplay = hasCvc ? (showCvc ? card.cvc : maskedCvc) : '';

  const tagsText = card.tags?.join(', ') ?? '';

  return (
    <>
      <div className="vault-panel-wrapper">
        {informationTitle}
        <div className="vault-detail-card bankcard-detail-card">
          <div className="detail-row">
            <div className="detail-dates">
              <div className="muted">{createdText}</div>
              {showUpdated && <div className="muted">{updatedText}</div>}
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

          {hasTitle && (
            <div className="detail-field">
              <div className="detail-label">{t('label.title')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{title}</div>
              </div>
            </div>
          )}

          {hasBankName && (
            <div className="detail-field">
              <div className="detail-label">{t('label.bankName')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{card.bankName ?? ''}</div>
                <div className="detail-value-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.bankName)}
                  >
                    <IconCopy />
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasHolder && (
            <div className="detail-field">
              <div className="detail-label">{t('label.holder')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{holderDisplay}</div>
                <div className="detail-value-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t(`action.${showHolder ? 'hide' : 'reveal'}`)}
                    onClick={detailActions.toggleHolderVisibility}
                  >
                    {showHolder ? <IconPreviewOff /> : <IconPreview />}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.holder, { isSecret: true })}
                  >
                    <IconCopy />
                  </button>
                </div>
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
                    aria-label={t(`action.${showNumber ? 'hide' : 'reveal'}`)}
                    onClick={detailActions.toggleNumberVisibility}
                  >
                    {showNumber ? <IconPreviewOff /> : <IconPreview />}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.number, { isSecret: true })}
                  >
                    <IconCopy />
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasExpiry && (
            <div className="detail-field bankcard-compact-expiry">
              <div className="detail-label">{t('label.expiry')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text">{card.expiryMmYy ?? ''}</div>
              </div>
            </div>
          )}

          {hasCvc && (
            <div className="detail-field bankcard-compact-cvc">
              <div className="detail-label">{t('label.cvc')}</div>
              <div className="detail-value-box">
                <div className="detail-value-text detail-value-text-monospace">{cvcDisplay}</div>
                <div className="detail-value-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t(`action.${showCvc ? 'hide' : 'reveal'}`)}
                    onClick={detailActions.toggleCvcVisibility}
                  >
                    {showCvc ? <IconPreviewOff /> : <IconPreview />}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('action.copy')}
                    onClick={() => detailActions.copyToClipboard(card.cvc, { isSecret: true })}
                  >
                    <IconCopy />
                  </button>
                </div>
              </div>
            </div>
          )}

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
