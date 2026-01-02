import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { BankCardFieldErrors, BankCardFormState, BankCardsViewModel } from './useBankCardsViewModel';
import { wasActuallyUpdated } from '../../utils/updatedAt';

export type BankCardsProps = {
  viewModel: BankCardsViewModel;
  sectionTitle: string;
};

export function BankCards({ viewModel, sectionTitle }: BankCardsProps) {
  const { t } = useTranslation('BankCards');
  const { t: tCommon } = useTranslation('Common');
  const {
    cards,
    selectedCardId,
    isCreateOpen,
    isEditOpen,
    isCreateSubmitting,
    isEditSubmitting,
    closeCreateModal,
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
        if (isEditOpen) viewModel.closeEditModal();
        if (isCreateOpen) closeCreateModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCreateModal, isCreateOpen, isEditOpen, viewModel.closeEditModal]);

  const renderDialog = (
    title: string,
    form: BankCardFormState | null,
    errors: BankCardFieldErrors,
    onClose: () => void,
    onSubmit: () => Promise<void>,
    onFieldChange: (field: keyof BankCardFormState, value: string) => void,
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

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`}>
          <div className="dialog-header">
            <h2 id={`${dialogId}-title`} className="dialog-title">
              {title}
            </h2>
          </div>

          <form className="dialog-body" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-title-input`}>
                {t('label.title')}
              </label>
              <input
                id={`${dialogId}-title-input`}
                className="input"
              ref={titleRef}
              value={form.title}
              onChange={(e) => onFieldChange('title', e.target.value)}
              placeholder={t('label.titlePlaceholder')}
            />
              {errors.title && <div className="form-error">{errors.title}</div>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-holder-input`}>
                {t('label.holder')}
              </label>
              <input
                id={`${dialogId}-holder-input`}
                className="input"
                value={form.holder}
                onChange={(e) => onFieldChange('holder', e.target.value)}
                placeholder={t('label.holderPlaceholder')}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-number-input`}>
                {t('label.number')}
              </label>
              <input
                id={`${dialogId}-number-input`}
                className="input"
                value={form.number}
                onChange={(e) => onFieldChange('number', e.target.value)}
                placeholder={t('label.numberPlaceholder')}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-expiry-input`}>
                {t('label.expiry')}
              </label>
              <input
                id={`${dialogId}-expiry-input`}
                className="input"
              value={form.expiryMmYy}
              onChange={(e) => onFieldChange('expiryMmYy', e.target.value)}
              placeholder={t('label.expiryPlaceholder')}
            />
            {errors.expiryMmYy && <div className="form-error">{errors.expiryMmYy}</div>}
          </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-cvc-input`}>
                {t('label.cvc')}
              </label>
              <input
                id={`${dialogId}-cvc-input`}
                className="input"
              value={form.cvc}
              onChange={(e) => onFieldChange('cvc', e.target.value)}
              placeholder={t('label.cvcPlaceholder')}
            />
            {errors.cvc && <div className="form-error">{errors.cvc}</div>}
          </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-note-input`}>
                {t('label.note')}
              </label>
              <textarea
                id={`${dialogId}-note-input`}
                className="input"
                rows={4}
                value={form.note}
                onChange={(e) => onFieldChange('note', e.target.value)}
                placeholder={t('label.notePlaceholder')}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-tags-input`}>
                {t('label.tags')}
              </label>
              <input
                id={`${dialogId}-tags-input`}
                className="input"
                value={form.tagsText}
                onChange={(e) => onFieldChange('tagsText', e.target.value)}
                placeholder={t('label.tagsPlaceholder')}
              />
            </div>

            <div className="dialog-footer dialog-footer--split">
              <div className="dialog-footer-left">
                <button className="btn btn-secondary" type="button" onClick={onClose}>
                  {tCommon('action.cancel')}
                </button>
              </div>

              <div className="dialog-footer-right">
                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  {submitLabel}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="vault-panel-wrapper">
      <div className="datacards-header">
        <div className="vault-section-header">{sectionTitle}</div>
      </div>

      {cards.length === 0 ? (
        <div className="vault-empty">{t('label.empty')}</div>
      ) : (
        <div className="vault-datacard-list">
          {cards.map((card) => {
            const isActive = selectedCardId === card.id;
            const isFavorite = card.isFavorite;
            const meta = card.metaLine || t('label.noMeta');
            const showUpdated = wasActuallyUpdated(card.createdAt, card.updatedAt);
            const updatedText = showUpdated ? `${t('label.updated')}: ${card.updatedAtLabel}` : '';

            return (
              <button
                key={card.id}
                className={`vault-datacard ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => viewModel.selectCard(card.id)}
              >
                <div className="datacard-top">
                  <div className="datacard-title">{card.title}</div>
                  {isFavorite && <span className="pill datacard-favorite">{t('label.favorite')}</span>}
                </div>

                <div className="datacard-meta">
                  <span>{meta}</span>
                  {showUpdated && <span className="muted">{updatedText}</span>}
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
          viewModel.createErrors,
          viewModel.closeCreateModal,
          viewModel.submitCreate,
          viewModel.updateCreateField,
          t('action.create'),
          createTitleRef,
          'bankcard-create-dialog',
          isCreateSubmitting
        )}

      {viewModel.isEditOpen &&
        renderDialog(
          t('dialog.editTitle'),
          viewModel.editForm,
          viewModel.editErrors,
          viewModel.closeEditModal,
          viewModel.submitEdit,
          viewModel.updateEditField,
          t('action.save'),
          editTitleRef,
          'bankcard-edit-dialog',
          isEditSubmitting
        )}
    </div>
  );
}
