import React, { useCallback, useMemo, useState } from 'react';
import { DataCard, Folder } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useDetails } from './useDetails';
import { EyeIcon, EyeOffIcon } from '../../../../components/icons/EyeIcons';
import { CopyIcon } from '../../icons/CopyIcon';
import { PaperclipIcon } from '../../icons/PaperclipIcon';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import AttachmentPreviewModal from '../modals/AttachmentPreviewModal';

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 3V15M12 15L7 10M12 15L17 10M5 21H19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 6H21M9 6V4H15V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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

  const previewMimeType = detailActions.previewPayload?.mimeType ?? '';
  const previewTitle = detailActions.previewPayload?.fileName ?? '';
  const previewObjectUrl = detailActions.previewPayload?.objectUrl ?? '';
  const previewDownloadHandler = detailActions.previewPayload
    ? () => detailActions.onDownloadAttachment(
        detailActions.previewPayload.attachmentId,
        detailActions.previewPayload.fileName
      )
    : undefined;

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
          <div className="attachments-title">
            <PaperclipIcon />
            <span>{t('attachments.title')}</span>
          </div>
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
                    className="icon-button"
                    type="button"
                    onClick={() => detailActions.onPreviewAttachment(attachment.id)}
                    aria-label={t('attachments.open')}
                  >
                    <EyeIcon />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() =>
                      detailActions.onDownloadAttachment(attachment.id, attachment.fileName)
                    }
                    aria-label={t('attachments.download')}
                  >
                    <DownloadIcon />
                  </button>
                  <button
                    className="icon-button icon-button-danger"
                    type="button"
                    onClick={() => setAttachmentToDelete(attachment.id)}
                    aria-label={t('attachments.delete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>

      <AttachmentPreviewModal
        open={detailActions.previewOpen}
        fileName={previewTitle}
        mime={previewMimeType}
        objectUrl={previewObjectUrl}
        onClose={detailActions.closePreview}
        onDownload={previewDownloadHandler}
        loading={detailActions.isPreviewLoading}
      />
    </>
  );
}
