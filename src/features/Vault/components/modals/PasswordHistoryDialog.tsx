import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { useTranslation } from '../../../../lib/i18n';
import { useToaster } from '../../../../components/Toaster';
import { clearPasswordHistory, getPasswordHistory } from '../../api/vaultApi';
import { PasswordHistoryEntry } from '../../types/ui';
import { IconCopy, IconHistory, IconPreview, IconPreviewOff } from '@/components/lucide/icons';

type PasswordHistoryDialogProps = {
  isOpen: boolean;
  datacardId: string;
  onClose: () => void;
};

const MASKED_PASSWORD = '••••••••';

const formatTimestamp = (value: string) => new Date(value).toLocaleString();

const PasswordHistoryDialog: React.FC<PasswordHistoryDialogProps> = ({ isOpen, datacardId, onClose }) => {
  const { t } = useTranslation('Details');
  const { t: tCommon } = useTranslation('Common');
  const { show: showToast } = useToaster();
  const [items, setItems] = useState<PasswordHistoryEntry[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!datacardId) return;
    try {
      const rows = await getPasswordHistory(datacardId);
      setItems(rows);
    } catch (err) {
      console.error(err);
      showToast(tCommon('error.operationFailed'), 'error');
      setItems([]);
    }
  }, [datacardId, showToast, tCommon]);

  useEffect(() => {
    if (isOpen) {
      setShowPasswords(false);
      void loadHistory();
    } else {
      setItems([]);
    }
  }, [isOpen, datacardId, loadHistory]);

  const copyPassword = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        showToast(t('toast.copySuccess'), 'success');
      } catch (err) {
        console.error(err);
        showToast(t('toast.copyError'), 'error');
      }
    },
    [showToast, t]
  );

  const handleClearHistory = useCallback(async () => {
    if (!datacardId) return;
    try {
      await clearPasswordHistory(datacardId);
      setItems([]);
    } catch (err) {
      console.error(err);
      showToast(tCommon('error.operationFailed'), 'error');
    } finally {
      setConfirmOpen(false);
    }
  }, [datacardId, showToast, tCommon]);

  const historyContent = useMemo(() => {
    if (!items.length) {
      return <div className="muted">{t('label.passwordHistoryEmpty')}</div>;
    }

    return (
      <div className="password-history-list">
        {items.map((entry) => (
          <div key={entry.id} className="password-history-row">
            <div className="password-history-meta">{formatTimestamp(entry.createdAt)}</div>
            <div className="password-history-value">{showPasswords ? entry.passwordValue : MASKED_PASSWORD}</div>
            <div className="password-history-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={t('action.copy')}
                onClick={() => void copyPassword(entry.passwordValue)}
              >
                <IconCopy />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [copyPassword, items, showPasswords, t]);

  if (!isOpen) return null;

  return (
    <>
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="password-history-title">
          <div className="dialog-header">
            <h2 id="password-history-title" className="dialog-title">
              <IconHistory />
              <span>{t('dialog.passwordHistoryTitle')}</span>
            </h2>
          </div>

          <div className="dialog-body password-history-body">
            <div className="password-history-controls">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                aria-label={showPasswords ? t('action.hide') : t('action.reveal')}
              >
                {showPasswords ? <IconPreviewOff /> : <IconPreview />}
                <span>{showPasswords ? t('action.hide') : t('action.reveal')}</span>
              </button>
            </div>
            {historyContent}
          </div>

          <div className="dialog-footer">
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              {tCommon('action.cancel')}
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!items.length}
            >
              {t('action.clearHistory')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t('dialog.passwordHistoryTitle')}
        description={t('dialog.clearHistoryConfirm')}
        confirmLabel={t('action.clearHistory')}
        cancelLabel={tCommon('action.cancel')}
        onConfirm={handleClearHistory}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default PasswordHistoryDialog;
