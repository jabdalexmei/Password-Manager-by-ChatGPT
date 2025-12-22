import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DataCard, Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useDetails } from './useDetails';
import { EyeIcon, EyeOffIcon } from '../../../../components/icons/EyeIcons';
import { CopyIcon } from '../../icons/CopyIcon';
import ConfirmDialog from '../../../../components/ConfirmDialog';

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
  const { t: tVault } = useTranslation('Vault');
  const { t: tCommon } = useTranslation('Common');
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
    return card.folderId ? folders.find((f) => f.id === card.folderId)?.name ?? '' : '';
  }, [card, folders]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const informationTitle = (
    <div className="vault-section-header">{tVault('information.title')}</div>
  );

  if (!card) {
    return (
      <div className="vault-panel-wrapper">
        {informationTitle}
        <div className="vault-empty">{t('empty.selectPrompt')}</div>
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
    : '';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const convertBase64ToBytes = useCallback((base64Data: string) => {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }, []);

  const previewMimeType = detailActions.previewPayload?.mimeType ?? '';
  const previewData = detailActions.previewPayload?.base64Data ?? '';
  const previewTitle = detailActions.previewPayload?.fileName ?? '';
  const isImagePreview = previewMimeType.startsWith('image/');
  const isTextPreview = previewMimeType.startsWith('text/');
  const isPdfPreview = previewMimeType === 'application/pdf';
  const decodedText = useMemo(() => {
    if (!isTextPreview || !previewData) return null;
    try {
      const bytes = convertBase64ToBytes(previewData);
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [convertBase64ToBytes, isTextPreview, previewData]);

  useEffect(() => {
    if (detailActions.previewOpen && isPdfPreview && previewData) {
      const blob = new Blob([convertBase64ToBytes(previewData)], {
        type: previewMimeType || 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setPdfPreviewUrl(null);
      };
    }
    setPdfPreviewUrl(null);
    return undefined;
  }, [convertBase64ToBytes, detailActions.previewOpen, isPdfPreview, previewData, previewMimeType]);

  return (
    <>
      <div className="vault-panel-wrapper">
        {informationTitle}
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
        <ConfirmDialog
          open={Boolean(attachmentToDelete)}
          title={t('attachments.deleteTitle')}
          description={t('attachments.deleteBody')}
          confirmLabel={t('attachments.deleteConfirm')}
          cancelLabel={tCommon('action.cancel')}
          onConfirm={() => {
            if (attachmentToDelete) {
              detailActions.onDeleteAttachment(attachmentToDelete);
            }
            setAttachmentToDelete(null);
          }}
          onCancel={() => setAttachmentToDelete(null)}
        />

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
          <div className="detail-value-text">{card.username ?? ''}</div>
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
          <div className="detail-value-text">{card.email ?? ''}</div>
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
          <div className="detail-value-text">{card.url ?? ''}</div>
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
          <div className="detail-value-text">{card.mobilePhone ?? ''}</div>
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
          <div className="detail-value-text detail-value-text-multiline">{card.note ?? ''}</div>
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
          <div className="detail-value-text">{card.tags && card.tags.length > 0 ? card.tags.join(', ') : ''}</div>
        </div>
      </div>

      <div className="detail-field attachments-panel">
        <div className="attachments-header">
          <div className="detail-label">{t('attachments.title')}</div>
          {!isTrashMode && (
            <button className="btn btn-secondary" type="button" onClick={detailActions.onAddAttachment}>
              {t('attachments.addFile')}
            </button>
          )}
        </div>
        <div className="attachments-body">
          {detailActions.attachments.length === 0 && (
            <div className="muted">{t('attachments.hint')}</div>
          )}
          {detailActions.attachments.map((attachment) => (
            <div key={attachment.id} className="attachment-row">
              <div className="attachment-info">
                <div className="attachment-name">{attachment.fileName}</div>
                <div className="attachment-meta">
                  {(attachment.mimeType ?? 'application/octet-stream') + ' / ' + formatSize(attachment.byteSize)}
                </div>
              </div>
              {!isTrashMode && (
                <div className="attachment-actions">
                  <button
                    className="btn btn-link"
                    type="button"
                    onClick={() => detailActions.onPreviewAttachment(attachment.id)}
                  >
                    {t('attachments.open')}
                  </button>
                  <button
                    className="btn btn-link"
                    type="button"
                    onClick={() =>
                      detailActions.onDownloadAttachment(attachment.id, attachment.fileName)
                    }
                  >
                    {t('attachments.download')}
                  </button>
                  <button
                    className="btn btn-link text-danger"
                    type="button"
                    onClick={() => setAttachmentToDelete(attachment.id)}
                  >
                    {t('attachments.delete')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>

      {detailActions.previewOpen && (
        <div className="dialog-backdrop">
          <div className="dialog preview-dialog" role="dialog" aria-modal="true">
            <div className="dialog-header">
              <h3 className="dialog-title">{previewTitle || t('attachments.title')}</h3>
            </div>
            <div className="dialog-body attachment-preview-body">
              {detailActions.isPreviewLoading && <div className="muted">{t('attachments.loadingPreview')}</div>}
              {!detailActions.isPreviewLoading && detailActions.previewPayload && (
                <>
                  {isImagePreview && (
                    <img
                      className="attachment-preview-image"
                      src={`data:${previewMimeType};base64,${previewData}`}
                      alt={previewTitle}
                    />
                  )}
                  {isTextPreview && (
                    <pre className="attachment-preview-text">
                      {decodedText ?? t('attachments.previewError')}
                    </pre>
                  )}
                  {isPdfPreview && (
                    pdfPreviewUrl ? (
                      <iframe
                        className="attachment-preview-pdf"
                        src={pdfPreviewUrl}
                        title={previewTitle || 'PDF Preview'}
                      />
                    ) : (
                      <div className="muted">{t('attachments.previewUnsupported')}</div>
                    )
                  )}
                  {!isImagePreview && !isTextPreview && !isPdfPreview && (
                    <div className="muted">{t('attachments.previewUnsupported')}</div>
                  )}
                </>
              )}
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" type="button" onClick={detailActions.closePreview}>
                {tCommon('action.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
