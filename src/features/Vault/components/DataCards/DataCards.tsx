import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { DataCardFormState, DataCardsViewModel } from './useDataCards';

const randomInt = (maxExclusive: number) => {
  if (maxExclusive <= 0) return 0;

  const maxUint32 = 0x100000000;
  const limit = Math.floor(maxUint32 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value < limit) {
      return value % maxExclusive;
    }
  }
};

const generateSecurePassword = (length: number) => {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    const index = randomInt(charset.length);
    result += charset[index] ?? '';
  }

  return result;
};

export type DataCardsProps = {
  viewModel: DataCardsViewModel;
};

export function DataCards({ viewModel }: DataCardsProps) {
  const { t } = useTranslation('DataCards');
  const { t: tCommon } = useTranslation('Common');
    const {
      cards,
      selectedCardId,
      showPassword,
      isCreateOpen,
      isEditOpen,
      isCreateSubmitting,
      isEditSubmitting,
      closeCreateModal,
      closeEditModal,
      togglePasswordVisibility,
    } = viewModel;
  const createTitleRef = useRef<HTMLInputElement | null>(null);
  const editTitleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isCreateOpen && createTitleRef.current) {
      createTitleRef.current.focus();
    }
    if (isEditOpen && editTitleRef.current) {
      editTitleRef.current.focus();
    }
  }, [isCreateOpen, isEditOpen]);

  useEffect(() => {
    if (!isCreateOpen && !isEditOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditOpen) closeEditModal();
        if (isCreateOpen) closeCreateModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCreateModal, closeEditModal, isCreateOpen, isEditOpen]);

  const renderDialog = (
    title: string,
    form: DataCardFormState | null,
    error: string | null,
    onClose: () => void,
    onSubmit: () => Promise<void>,
    onFieldChange: (field: keyof DataCardFormState, value: string | boolean | null) => void,
    submitLabel: string,
    titleRef: React.RefObject<HTMLInputElement>,
    dialogId: string,
    isSubmitting: boolean
  ) => {
    if (!form) return null;

    const handleSubmit = async (event: React.FormEvent) => {
      event.preventDefault();
      await onSubmit();
    };

    const generatePassword = () => {
      const generated = generateSecurePassword(10);
      onFieldChange('password', generated);
    };

    const titleElementId = 'dialog-title';

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleElementId}>
          <div className="dialog-header">
            <h2 id={titleElementId} className="dialog-title">
              {title}
            </h2>
          </div>

          <form className="dialog-body" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-title`}>
                {t('label.title')}*
              </label>
              <input
                id={`${dialogId}-title`}
                className="input"
                ref={titleRef}
                value={form.title}
                onChange={(e) => onFieldChange('title', e.target.value)}
              />
              {error && <div className="form-error">{error}</div>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-url`}>
                {t('label.url')}
              </label>
              <input
                id={`${dialogId}-url`}
                className="input"
                type="url"
                value={form.url}
                onChange={(e) => onFieldChange('url', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-username`}>
                {t('label.username')}
              </label>
              <input
                id={`${dialogId}-username`}
                className="input"
                value={form.username}
                onChange={(e) => onFieldChange('username', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-email`}>
                {t('label.email')}
              </label>
              <input
                id={`${dialogId}-email`}
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => onFieldChange('email', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-password`}>
                {t('label.password')}
              </label>
              <div className="input-with-actions">
                <input
                  id={`${dialogId}-password`}
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => onFieldChange('password', e.target.value)}
                />
                <div className="input-actions">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={generatePassword}
                    aria-label={t('action.generate')}
                  >
                    {t('action.generate')}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={togglePasswordVisibility}
                    aria-label={t('action.togglePasswordVisibility')}
                  >
                    {showPassword ? t('action.hide') : t('action.reveal')}
                  </button>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-mobile`}>
                {t('label.mobile')}
              </label>
              <input
                id={`${dialogId}-mobile`}
                className="input"
                value={form.mobilePhone}
                onChange={(e) => onFieldChange('mobilePhone', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-note`}>
                {t('label.note')}
              </label>
              <textarea
                id={`${dialogId}-note`}
                className="textarea"
                value={form.note}
                onChange={(e) => onFieldChange('note', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-tags`}>
                {t('label.tags')}
              </label>
              <input
                id={`${dialogId}-tags`}
                className="input"
                value={form.tagsText}
                placeholder={t('label.tagsPlaceholder')}
                onChange={(e) => onFieldChange('tagsText', e.target.value)}
              />
            </div>

            <div className="dialog-footer">
              <button className="btn btn-secondary" type="button" onClick={onClose}>
                {tCommon('action.cancel')}
              </button>
              <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="vault-panel-wrapper">
      <div className="datacards-header">
        <div className="vault-section-header">{t('label.dataCardsTitle')}</div>
      </div>

      {cards.length === 0 ? (
        <div className="vault-empty">{t('label.empty')}</div>
      ) : (
        <div className="vault-datacard-list">
          {cards.map((card) => {
            const isActive = selectedCardId === card.id;
            const isFavorite = card.isFavorite || card.tags?.includes('favorite');
            const meta = card.metaLine || t('label.noMeta');
            const updatedText = `${t('label.updated')}: ${card.updatedAtLabel}`;

            return (
              <button
                key={card.id}
                className={`vault-datacard ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => viewModel.selectCard(card.id)}
              >
                <div className="datacard-title">{card.title}</div>
                <div className="datacard-meta">
                  <span>{meta}</span>
                  <div>
                    {isFavorite && <span className="pill">{t('label.favorite')}</span>}
                    <span className="muted">{updatedText}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {viewModel.isCreateOpen &&
        renderDialog(
          t('dialog.createTitle'),
          viewModel.createForm,
          viewModel.createError,
          viewModel.closeCreateModal,
          viewModel.submitCreate,
          viewModel.updateCreateField,
          t('action.create'),
          createTitleRef,
          'datacard-create-dialog',
          isCreateSubmitting
        )}

      {viewModel.isEditOpen &&
        renderDialog(
          t('dialog.editTitle'),
          viewModel.editForm,
          viewModel.editError,
          viewModel.closeEditModal,
          viewModel.submitEdit,
          viewModel.updateEditField,
          t('action.save'),
          editTitleRef,
          'datacard-edit-dialog',
          isEditSubmitting
        )}
    </div>
  );
}
