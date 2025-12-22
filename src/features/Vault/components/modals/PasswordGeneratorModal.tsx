import React from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { calculateStrengthBits, PasswordGeneratorOptions } from '../../utils/passwordGenerator';
import { IconCopy, IconRegenerate } from '@/components/lucide/icons';

type PasswordGeneratorModalProps = {
  isOpen: boolean;
  options: PasswordGeneratorOptions;
  generatedPassword: string;
  charsetSize: number;
  onChangeOptions: (options: PasswordGeneratorOptions) => void;
  onClose: () => void;
  onUse: () => void;
  onRegenerate: () => void;
  onCopy: () => Promise<void>;
};

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  options,
  charsetSize,
  generatedPassword,
  onChangeOptions,
  onClose,
  onUse,
  onRegenerate,
  onCopy,
}) => {
  const { t } = useTranslation('DataCards');

  if (!isOpen) return null;

  const bits = calculateStrengthBits(options.length, charsetSize);

  const handleCheckboxChange = (key: keyof PasswordGeneratorOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChangeOptions({ ...options, [key]: event.target.checked });
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog generator-dialog" role="dialog" aria-modal="true" aria-labelledby="generator-title">
        <div className="dialog-header">
          <h2 id="generator-title" className="dialog-title">
            {t('generator.title')}
          </h2>
        </div>

        <div className="dialog-body generator-body">
          <div className="generator-row">
            <label className="form-label" htmlFor="generated-password">
              {t('generator.generatedPassword')}
            </label>
            <div className="input-with-actions">
              <input id="generated-password" className="input" value={generatedPassword} readOnly />
              <div className="input-actions">
                <button className="icon-button" type="button" aria-label={t('action.copy')} onClick={() => void onCopy()}>
                  <IconCopy />
                </button>
                <button
                  className="icon-button icon-button-primary"
                  type="button"
                  aria-label={t('generator.regenerate')}
                  onClick={onRegenerate}
                >
                  <IconRegenerate />
                </button>
              </div>
            </div>
          </div>

          <div className="generator-strength-block">
            <div className="generator-strength-header">
              <span className="generator-strength-title">{t('generator.passwordStrength')}</span>
              <span className="generator-strength-value">{t('generator.strengthLabel', { bits })}</span>
            </div>

            <div className="generator-strength-bar">
              <div
                className="generator-strength-fill"
                style={{ width: `${Math.min(100, (bits / 128) * 100)}%` }}
              />
            </div>
          </div>

          <div className="generator-row">
            <label className="form-label" htmlFor="length-slider">
              {t('generator.length')}: {options.length}
            </label>
            <input
              id="length-slider"
              type="range"
              min={6}
              max={32}
              value={options.length}
              onChange={(event) => onChangeOptions({ ...options, length: Number(event.target.value) })}
            />
          </div>

          <div className="generator-options">
            <label className="checkbox">
              <input type="checkbox" checked={options.lowercase} onChange={handleCheckboxChange('lowercase')} />
              <span>{t('generator.lowercase')}</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={options.uppercase} onChange={handleCheckboxChange('uppercase')} />
              <span>{t('generator.uppercase')}</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={options.numbers} onChange={handleCheckboxChange('numbers')} />
              <span>{t('generator.numbers')}</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={options.symbols} onChange={handleCheckboxChange('symbols')} />
              <span>{t('generator.symbols')}</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={options.excludeSimilar} onChange={handleCheckboxChange('excludeSimilar')} />
              <span>{t('generator.excludeSimilar')}</span>
            </label>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            {t('action.cancel')}
          </button>
          <button className="btn btn-primary" type="button" onClick={onUse} disabled={!generatedPassword || charsetSize === 0}>
            {t('generator.use')}
          </button>
        </div>
      </div>
    </div>
  );
};
