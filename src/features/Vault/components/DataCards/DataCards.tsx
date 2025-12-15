import React from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { DataCardFormState, DataCardsViewModel } from './useDataCards';

export type DataCardsProps = {
  viewModel: DataCardsViewModel;
};

export function DataCards({ viewModel }: DataCardsProps) {
  const { t } = useTranslation('DataCards');
  const { t: tCommon } = useTranslation('Common');
  const { cards, selectedCardId } = viewModel;

  const renderDialog = (
    title: string,
    form: DataCardFormState | null,
    error: string | null,
    onClose: () => void,
    onSubmit: () => Promise<void>,
    onFieldChange: (field: keyof DataCardFormState, value: string | boolean | null) => void,
    submitLabel: string
  ) => {
    if (!form) return null;

    const handleFolderChange = (value: string) => {
      onFieldChange('folderId', value || null);
    };

    const generatePassword = () => {
      const generated = Math.random().toString(36).slice(2, 12);
      onFieldChange('password', generated);
    };

    return (
      <div className="dialog-backdrop">
        <div className="dialog dialog-wide">
          <div className="dialog-header">
            <div>
              <h3 className="dialog-title">{title}</h3>
            </div>
            <button className="dialog-close" aria-label={tCommon('action.close')} onClick={onClose} type="button">
              ×
            </button>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="datacard-title">
                {t('label.title')}*
              </label>
              <input
                id="datacard-title"
                value={form.title}
                onChange={(e) => onFieldChange('title', e.target.value)}
              />
              {error && <div className="form-error">{error}</div>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-folder">
                {t('label.folder')}
              </label>
              <select
                id="datacard-folder"
                value={form.folderId ?? ''}
                onChange={(e) => handleFolderChange(e.target.value)}
              >
                <option value="">{t('label.noFolder')}</option>
                {viewModel.folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-username">
                {t('label.username')}
              </label>
              <input
                id="datacard-username"
                value={form.username}
                onChange={(e) => onFieldChange('username', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-email">
                {t('label.email')}
              </label>
              <input id="datacard-email" value={form.email} onChange={(e) => onFieldChange('email', e.target.value)} />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-url">
                {t('label.url')}
              </label>
              <input id="datacard-url" value={form.url} onChange={(e) => onFieldChange('url', e.target.value)} />
            </div>

            <div className="form-field">
              <div className="form-label">{t('label.password')}</div>
              <div className="button-row">
                <input value={form.password} onChange={(e) => onFieldChange('password', e.target.value)} />
                <button className="icon-button" type="button" onClick={generatePassword} aria-label={t('action.generate')}>
                  ⇢
                </button>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-mobile">
                {t('label.mobile')}
              </label>
              <input
                id="datacard-mobile"
                value={form.mobilePhone}
                onChange={(e) => onFieldChange('mobilePhone', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-note">
                {t('label.note')}
              </label>
              <textarea
                id="datacard-note"
                value={form.note}
                onChange={(e) => onFieldChange('note', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-tags">
                {t('label.tags')}
              </label>
              <input
                id="datacard-tags"
                value={form.tagsText}
                placeholder={t('label.tagsPlaceholder')}
                onChange={(e) => onFieldChange('tagsText', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="datacard-favorite">
                <input
                  id="datacard-favorite"
                  type="checkbox"
                  checked={form.isFavorite}
                  onChange={(e) => onFieldChange('isFavorite', e.target.checked)}
                />
                {t('label.markFavorite')}
              </label>
            </div>
          </div>

          <div className="dialog-actions">
            <button className="btn btn-outline" type="button" onClick={onClose}>
              {t('action.cancel')}
            </button>
            <button className="btn btn-primary" type="button" onClick={onSubmit}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="vault-panel-wrapper">
      <div className="datacards-header">
        <div className="vault-section-header">{t('label.dataCardsTitle')}</div>
        <button className="btn btn-primary" type="button" onClick={viewModel.openCreateModal}>
          {t('label.addDataCard')}
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="vault-empty">{t('label.empty')}</div>
      ) : (
        <div className="vault-datacard-list">
          {cards.map((card) => {
            const isActive = selectedCardId === card.id;
            const isFavorite = card.tags?.includes('favorite');
            const meta = card.username || card.email || card.url || t('label.noMeta');
            const updatedText = `${t('label.updated')}: ${new Date(card.updatedAt).toLocaleString()}`;

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
          t('action.create')
        )}

      {viewModel.isEditOpen &&
        renderDialog(
          t('dialog.editTitle'),
          viewModel.editForm,
          viewModel.editError,
          viewModel.closeEditModal,
          viewModel.submitEdit,
          viewModel.updateEditField,
          t('action.save')
        )}
    </div>
  );
}
