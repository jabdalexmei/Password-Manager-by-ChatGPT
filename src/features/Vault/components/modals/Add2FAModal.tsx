import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { BrowserQRCodeReader } from '@zxing/browser';
import { normalizeTotpInput } from '../../utils/totp';

type Props = {
  isOpen: boolean;
  existingUri: string | null;
  defaults: { issuer: string; label: string };
  onCancel: () => void;
  onSave: (uri: string) => void;
  onRemove: () => void;
};

export const Add2FAModal: React.FC<Props> = ({
  isOpen,
  existingUri,
  defaults,
  onCancel,
  onSave,
  onRemove,
}) => {
  const { t } = useTranslation('DataCards');
  const [tab, setTab] = useState<'text' | 'qr'>('text');
  const [textValue, setTextValue] = useState(existingUri ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrFileName, setQrFileName] = useState<string>(t('twoFactor.qr.noFileChosen'));
  const wasOpenRef = React.useRef(false);

  const canRemove = useMemo(() => (existingUri ?? '').trim().length > 0, [existingUri]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      setTextValue(existingUri ?? '');
      setError(null);
      setTab('text');
      setQrFileName(t('twoFactor.qr.noFileChosen'));
    }
  }, [existingUri, isOpen]);

  if (!isOpen) return null;

  const handleSaveText = () => {
    setError(null);
    const result = normalizeTotpInput(textValue, defaults);
    if (!result.ok) {
      setError(t(`twoFactor.error.${result.error}`));
      return;
    }
    onSave(result.uri);
  };

  const handleQrFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const url = URL.createObjectURL(file);
      try {
        const reader = new BrowserQRCodeReader();
        const decoded = await reader.decodeFromImageUrl(url);
        const text = decoded.getText();
        const norm = normalizeTotpInput(text, defaults);
        if (!norm.ok) {
          setError(t(`twoFactor.error.${norm.error}`));
          return;
        }
        setTextValue(norm.uri);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError(t('twoFactor.error.QR_DECODE_FAILED'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop dialog-backdrop--inner">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="add2fa-title">
        <div className="dialog-header">
          <h2 id="add2fa-title" className="dialog-title">
            {t('twoFactor.title')}
          </h2>
        </div>

        <div className="dialog-body">
          <div className="button-row" style={{ marginBottom: 12 }}>
            <button
              className={`btn ${tab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              type="button"
              onClick={() => setTab('text')}
            >
              {t('twoFactor.tab.text')}
            </button>
            <button
              className={`btn ${tab === 'qr' ? 'btn-primary' : 'btn-secondary'}`}
              type="button"
              onClick={() => setTab('qr')}
            >
              {t('twoFactor.tab.qr')}
            </button>
          </div>

          {tab === 'text' ? (
            <div className="form-field">
              <label className="form-label" htmlFor="totp-text">
                {t('twoFactor.text.label')}
              </label>
              <textarea
                id="totp-text"
                className="textarea"
                value={textValue}
                placeholder={t('twoFactor.text.placeholder')}
                onChange={(e) => {
                  setTextValue(e.target.value);
                  setError(null);
                }}
              />
              {error && <div className="form-error">{error}</div>}
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {t('twoFactor.text.hint')}
              </div>
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label" htmlFor="totp-qr">
                {t('twoFactor.qr.label')}
              </label>
              <div className="file-picker">
                <input
                  id="totp-qr"
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;

                    setQrFileName(file.name);

                    void handleQrFile(file);

                    e.currentTarget.value = '';
                  }}
                />

                
                <div className="input file-picker__name" title={qrFileName}>
                  {qrFileName}
                </div>

                <label
                  htmlFor="totp-qr"
                  className="btn btn-secondary file-picker__btn"
                  aria-disabled={busy ? 'true' : 'false'}
                >
                  {t('twoFactor.qr.chooseFile')}
                </label>

              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="file-picker__status muted" aria-live="polite">
                {busy ? t('twoFactor.qr.loading') : '\u00A0'}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer dialog-footer--split">
          <div className="dialog-footer-left">
            <button className="btn btn-secondary" type="button" onClick={onCancel}>
              {t('action.cancel')}
            </button>
            {canRemove && (
              <button className="btn btn-danger" type="button" onClick={onRemove}>
                {t('twoFactor.remove')}
              </button>
            )}
          </div>
          <div className="dialog-footer-right">
            <button className="btn btn-primary" type="button" onClick={handleSaveText}>
              {t('action.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
