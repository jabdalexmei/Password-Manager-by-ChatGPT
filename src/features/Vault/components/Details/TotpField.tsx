import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { generateTotpCode } from '../../utils/totp';
import { copyTextToClipboard } from '../../../../lib/clipboard';

export const TotpField: React.FC<{ uri: string }> = ({ uri }) => {
  const { t } = useTranslation('Details');
  const [now, setNow] = useState(() => Date.now());
  const [copyOk, setCopyOk] = useState<null | boolean>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const data = useMemo(() => {
    try {
      return generateTotpCode(uri, now);
    } catch {
      return null;
    }
  }, [uri, now]);

  if (!data) {
    return (
      <div className="detail-row">
        <div className="detail-label">{t('label.totp')}</div>
        <div className="detail-value">{t('totp.invalid')}</div>
      </div>
    );
  }

  return (
    <div className="detail-row">
      <div className="detail-label">{t('label.totp')}</div>
      <div className="detail-value">
        <div className="detail-value-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>{data.token}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {t('totp.expiresIn', { seconds: data.remaining })}
            </div>
            <button
              className="btn btn-secondary btn-icon"
              type="button"
              title={t('action.copy')}
              onClick={async () => {
                const ok = await copyTextToClipboard(data.token);
                setCopyOk(ok);
                window.setTimeout(() => setCopyOk(null), 1200);
              }}
            >
              {t('action.copy')}
            </button>
            {copyOk === true && <span className="muted">{t('toast.copySuccess')}</span>}
            {copyOk === false && <span className="muted">{t('toast.copyError')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
