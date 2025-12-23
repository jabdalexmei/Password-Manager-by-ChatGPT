import React, { useMemo } from 'react';
import { useTranslation } from '../../../../lib/i18n';

type AttachmentPreviewDialogProps = {
  open: boolean;
  fileName: string;
  mime: string;
  objectUrl: string;
  onClose: () => void;
  onDownload?: () => void;
  loading?: boolean;
};

export default function AttachmentPreviewDialog({
  open,
  fileName,
  mime,
  objectUrl,
  onClose,
  onDownload,
  loading = false,
}: AttachmentPreviewDialogProps) {
  const { t } = useTranslation('Details');
  const { t: tCommon } = useTranslation('Common');

  const isImage = useMemo(() => mime?.startsWith('image/'), [mime]);
  const isPdf = useMemo(() => mime === 'application/pdf', [mime]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div className="dialog preview-dialog" role="dialog" aria-modal="true">
        <div className="dialog-header">
          <h3 className="dialog-title">{fileName || t('attachments.title')}</h3>
        </div>
        <div className="dialog-body attachment-preview-body">
          {loading && <div className="muted">{t('attachments.loadingPreview')}</div>}
          {!loading && isImage && (
            <img className="attachment-preview-image" src={objectUrl} alt={fileName} />
          )}
          {!loading && isPdf && (
            <iframe className="attachment-preview-pdf" src={objectUrl} title={fileName || 'PDF Preview'} />
          )}
          {!loading && !isImage && !isPdf && (
            <div className="attachment-preview-unsupported">
              <div className="muted">{t('attachments.previewUnsupported')}</div>
              {onDownload && (
                <button className="btn btn-secondary" type="button" onClick={onDownload}>
                  {t('attachments.download')}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            {tCommon('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
