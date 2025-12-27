import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import {
  IconAttachment,
  IconPreview,
  IconPreviewOff,
  IconRename,
  IconRegenerate,
  IconTrash,
} from '@/components/lucide/icons';
import { PasswordGeneratorModal } from '../modals/PasswordGeneratorModal';
import { CustomFieldModal } from '../modals/CustomFieldModal';
import { CustomFieldRenameModal } from '../modals/CustomFieldRenameModal';
import { Add2FAModal } from '../modals/Add2FAModal';
import { useToaster } from '../../../../components/Toaster';
import { generatePassword, PasswordGeneratorOptions } from '../../utils/passwordGenerator';
import { DataCardFormState, DataCardsViewModel } from './useDataCards';
import { open } from '@tauri-apps/plugin-dialog';

export type DataCardsProps = {
  viewModel: DataCardsViewModel;
  sectionTitle: string;
  clipboardAutoClearEnabled?: boolean;
  clipboardClearTimeoutSeconds?: number;
};

export function DataCards({
  viewModel,
  sectionTitle,
  clipboardAutoClearEnabled,
  clipboardClearTimeoutSeconds,
}: DataCardsProps) {
  const { t } = useTranslation('DataCards');
  const { t: tCommon } = useTranslation('Common');
  const { show: showToast } = useToaster();
  const {
    cards,
    selectedCardId,
    showPassword,
    isCreateOpen,
    isEditOpen,
    isCreateSubmitting,
    isEditSubmitting,
    togglePasswordVisibility,
  } = viewModel;
  const createTitleRef = useRef<HTMLInputElement | null>(null);
  const editTitleRef = useRef<HTMLInputElement | null>(null);
  const [isGeneratorOpen, setGeneratorOpen] = useState(false);
  const [generatorOptions, setGeneratorOptions] = useState<PasswordGeneratorOptions>({
    length: 16,
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: false,
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [charsetSize, setCharsetSize] = useState(0);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldModalError, setCustomFieldModalError] = useState<string | null>(null);
  const [customFieldTargetDialogId, setCustomFieldTargetDialogId] = useState<string | null>(null);
  const [isEditFieldsMode, setIsEditFieldsMode] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTargetRowId, setRenameTargetRowId] = useState<string | null>(null);
  const [renameTargetDialogId, setRenameTargetDialogId] = useState<
    'datacard-create-dialog' | 'datacard-edit-dialog' | null
  >(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [twoFactorTargetDialogId, setTwoFactorTargetDialogId] = useState<
    'datacard-create-dialog' | 'datacard-edit-dialog' | null
  >(null);
  const genPwdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genPwdLastCopiedRef = useRef<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const regeneratePassword = useCallback((options: PasswordGeneratorOptions) => {
    const { password, charsetSize: size } = generatePassword(options);
    setGeneratedPassword(password);
    setCharsetSize(size);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    viewModel.closeEditModal();
    setIsEditFieldsMode(false);
    setIsRenameModalOpen(false);
    setRenameTargetRowId(null);
    setRenameTargetDialogId(null);
    setRenameName('');
    setRenameError(null);
  }, [viewModel]);

  const handleCloseCreateModal = useCallback(() => {
    viewModel.closeCreateModal();
    setIsEditFieldsMode(false);
    setIsRenameModalOpen(false);
    setRenameError(null);
    setRenameTargetRowId(null);
    setRenameTargetDialogId(null);
  }, [viewModel]);

  useEffect(() => {
    if (!isGeneratorOpen) return;
    regeneratePassword(generatorOptions);
  }, [generatorOptions, isGeneratorOpen, regeneratePassword]);

  const openGenerator = () => {
    setGeneratorOpen(true);
    regeneratePassword(generatorOptions);
  };

  const closeGenerator = () => {
    setGeneratorOpen(false);
  };

  const clearGenPwdTimer = useCallback(() => {
    if (genPwdTimeoutRef.current) {
      clearTimeout(genPwdTimeoutRef.current);
      genPwdTimeoutRef.current = null;
    }
    genPwdLastCopiedRef.current = null;
  }, []);

  useEffect(() => clearGenPwdTimer, [clearGenPwdTimer]);

  const handleUseGeneratedPassword = () => {
    if (generatedPassword) {
      if (viewModel.isCreateOpen) {
        viewModel.updateCreateField('password', generatedPassword);
      }
      if (viewModel.isEditOpen && viewModel.editForm) {
        viewModel.updateEditField('password', generatedPassword);
      }
      if (!showPassword) {
        togglePasswordVisibility();
      }
    }
    closeGenerator();
  };

  const handleCopyGeneratedPassword = async () => {
    const DEFAULT_CLIPBOARD_CLEAR_TIMEOUT_SECONDS = 20;
    if (!generatedPassword || !generatedPassword.trim()) return;
    clearGenPwdTimer();

    try {
      await navigator.clipboard.writeText(generatedPassword);
      showToast(t('toast.copySuccess'), 'success');

      const enabled = clipboardAutoClearEnabled ?? true;
      if (!enabled) return;

      genPwdLastCopiedRef.current = generatedPassword;
      const timeoutMs = (clipboardClearTimeoutSeconds ?? DEFAULT_CLIPBOARD_CLEAR_TIMEOUT_SECONDS) * 1000;
      genPwdTimeoutRef.current = window.setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === genPwdLastCopiedRef.current) {
            await navigator.clipboard.writeText('');
          }
        } catch (err) {
          console.error(err);
        } finally {
          genPwdTimeoutRef.current = null;
          genPwdLastCopiedRef.current = null;
        }
      }, timeoutMs);
    } catch (error) {
      console.error(error);
      showToast(t('toast.copyError'), 'error');
      clearGenPwdTimer();
    }
  };

  useEffect(() => {
    if (isCreateOpen && createTitleRef.current) {
      createTitleRef.current.focus();
    }
    if (isEditOpen && editTitleRef.current) {
      editTitleRef.current.focus();
    }
  }, [isCreateOpen, isEditOpen]);

  useEffect(() => {
    if (isCreateOpen || isEditOpen) return;
    setIsActionMenuOpen(false);
    setIsCustomFieldModalOpen(false);
    setCustomFieldTargetDialogId(null);
    setIsEditFieldsMode(false);
    setIsRenameModalOpen(false);
    setRenameTargetRowId(null);
    setRenameTargetDialogId(null);
    setRenameName('');
    setRenameError(null);
    setIs2faModalOpen(false);
    setTwoFactorTargetDialogId(null);
  }, [isCreateOpen, isEditOpen]);

  useEffect(() => {
    if (!isCreateOpen && !isEditOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isActionMenuOpen) {
          setIsActionMenuOpen(false);
          return;
        }
        if (is2faModalOpen) {
          setIs2faModalOpen(false);
          setTwoFactorTargetDialogId(null);
          return;
        }
        if (isCustomFieldModalOpen) {
          setIsCustomFieldModalOpen(false);
          return;
        }
        if (isRenameModalOpen) {
          setIsRenameModalOpen(false);
          setRenameError(null);
          return;
        }
        if (isEditOpen) handleCloseEditModal();
        if (isCreateOpen) handleCloseCreateModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCloseCreateModal,
    handleCloseEditModal,
    isActionMenuOpen,
    is2faModalOpen,
    isCreateOpen,
    isCustomFieldModalOpen,
    isEditOpen,
    isRenameModalOpen,
  ]);

  useEffect(() => {
    if (!isActionMenuOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideMenu = actionMenuRef.current?.contains(target);
      const isInsideButton = actionMenuButtonRef.current?.contains(target);
      if (!isInsideMenu && !isInsideButton) {
        setIsActionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionMenuOpen]);

  const renderDialog = (
    title: string,
    form: DataCardFormState | null,
    error: string | null,
    folderError: string | null,
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

    const handleAddAttachments = async () => {
      const selection = await open({ multiple: true });
      const paths = Array.isArray(selection) ? selection : selection ? [selection] : [];
      viewModel.addCreateAttachments(paths.filter((p): p is string => typeof p === 'string'));
    };

    const titleElementId = 'dialog-title';
    const isCreateDialog = dialogId === 'datacard-create-dialog';

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleElementId}>
          <div className="dialog-header dialog-header--with-actions">
            <h2 id={titleElementId} className="dialog-title">
              {title}
            </h2>
            <div className="dialog-header-actions">
              <button
                type="button"
                className="btn btn-icon dialog-actionbar"
                aria-label={t('action.more')}
                title={t('action.more')}
                onClick={() => {
                  const isSameDialog = customFieldTargetDialogId === dialogId;
                  setCustomFieldTargetDialogId(dialogId);
                  setIsActionMenuOpen((prev) => (isSameDialog ? !prev : true));
                }}
                ref={actionMenuButtonRef}
              >
                <span className="dialog-actionbar-dots">⋯</span>
              </button>

              {isActionMenuOpen && customFieldTargetDialogId === dialogId && (
                <div className="dialog-actionmenu" role="menu" ref={actionMenuRef}>
                  <button
                    type="button"
                    className="dialog-actionmenu-item"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setTwoFactorTargetDialogId(
                        dialogId === 'datacard-create-dialog' ? 'datacard-create-dialog' : 'datacard-edit-dialog'
                      );
                      setIs2faModalOpen(true);
                    }}
                  >
                    {form.totpUri?.trim() ? t('twoFactor.editAction') : t('twoFactor.addAction')}
                  </button>
                  <button
                    type="button"
                    className="dialog-actionmenu-item"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setCustomFieldTargetDialogId(dialogId);
                      setCustomFieldName('');
                      setCustomFieldModalError(null);
                      setIsCustomFieldModalOpen(true);
                    }}
                  >
                    {t('customFields.add')}
                  </button>
                  {(form?.customFields?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      className="dialog-actionmenu-item"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setIsEditFieldsMode((prev) => !prev);
                      }}
                    >
                      {t('customFields.editFields')}
                    </button>
                  )}
                </div>
              )}
            </div>
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
                    onClick={openGenerator}
                    aria-label={t('action.openGenerator')}
                  >
                    <IconRegenerate />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={togglePasswordVisibility}
                    aria-label={t('action.togglePasswordVisibility')}
                  >
                    {showPassword ? <IconPreviewOff /> : <IconPreview />}
                  </button>
                </div>
              </div>
            </div>

            {form.customFields.map((row) => (
              <div className="form-field" key={row.id}>
                <label className="form-label" htmlFor={`${dialogId}-cf-${row.id}`}>
                  {row.key}
                </label>
                <div className="input-with-actions">
                  <input
                    id={`${dialogId}-cf-${row.id}`}
                    className="input"
                    value={row.value}
                    onChange={(e) => {
                      if (dialogId === 'datacard-create-dialog') {
                        viewModel.updateCreateCustomFieldValue(row.id, e.target.value);
                      } else {
                        viewModel.updateEditCustomFieldValue(row.id, e.target.value);
                      }
                    }}
                  />
                  {isEditFieldsMode && (
                    <div className="input-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t('customFields.rename')}
                        title={t('customFields.rename')}
                        onClick={() => {
                          setRenameTargetRowId(row.id);
                          setRenameTargetDialogId(
                            dialogId === 'datacard-create-dialog'
                              ? 'datacard-create-dialog'
                              : 'datacard-edit-dialog'
                          );
                          setRenameName(row.key);
                          setRenameError(null);
                          setIsRenameModalOpen(true);
                        }}
                      >
                        <IconRename />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button-danger"
                        aria-label={t('customFields.delete')}
                        title={t('customFields.delete')}
                        onClick={() => {
                          if (dialogId === 'datacard-create-dialog') {
                            viewModel.removeCreateCustomFieldById(row.id);
                          } else {
                            viewModel.removeEditCustomFieldById(row.id);
                          }
                        }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

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
              <label className="form-label" htmlFor={`${dialogId}-folder`}>
                {t('label.folder')}
              </label>
              <input
                id={`${dialogId}-folder`}
                className="input"
                list="folder-options"
                value={form.folderName}
                onChange={(e) => onFieldChange('folderName', e.target.value)}
              />
              <datalist id="folder-options">
                {viewModel.folders
                  .filter((folder) => !folder.isSystem)
                  .map((folder) => (
                    <option key={folder.id} value={folder.name} />
                  ))}
              </datalist>
              {folderError && <div className="form-error">{folderError}</div>}
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

            {isCreateDialog && (
              <div className="dialog-attachments">
                <div className="dialog-attachments-header">
                  <button className="btn btn-secondary btn-attach" type="button" onClick={handleAddAttachments}>
                    <IconAttachment />
                    {t('attachments.add')}
                  </button>
                </div>

                {viewModel.createAttachments.length > 0 && (
                  <div className="dialog-attachments-list">
                    <div className="muted">{t('attachments.selected')}</div>
                    {viewModel.createAttachments.map((attachment) => (
                      <div key={attachment.path} className="dialog-attachments-item">
                        <span className="dialog-attachments-name">{attachment.name}</span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => viewModel.removeCreateAttachment(attachment.path)}
                        >
                          {t('attachments.remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
            const updatedText = `${t('label.updated')}: ${card.updatedAtLabel}`;

            return (
              <button
                key={card.id}
                className={`vault-datacard ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => viewModel.selectCard(card.id)}
              >
                <div className="datacard-top">
                  <div className="datacard-title">{card.title}</div>
                  {card.hasTotp && <span className="pill">{t('twoFactor.pill')}</span>}
                  {isFavorite && <span className="pill datacard-favorite">{t('label.favorite')}</span>}
                </div>

                <div className="datacard-meta">
                  <span>{meta}</span>
                  <span className="muted">{updatedText}</span>
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
          viewModel.createFolderError,
          handleCloseCreateModal,
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
          viewModel.editFolderError,
          handleCloseEditModal,
          viewModel.submitEdit,
          viewModel.updateEditField,
          t('action.save'),
          editTitleRef,
          'datacard-edit-dialog',
          isEditSubmitting
        )}

      <CustomFieldModal
        isOpen={isCustomFieldModalOpen}
        name={customFieldName}
        error={customFieldModalError}
        onChangeName={(value) => {
          setCustomFieldName(value);
          setCustomFieldModalError(null);
        }}
        onCancel={() => {
          setIsCustomFieldModalOpen(false);
          setCustomFieldModalError(null);
        }}
        onOk={() => {
          if (!customFieldTargetDialogId) return;
          const result =
            customFieldTargetDialogId === 'datacard-create-dialog'
              ? viewModel.addCreateCustomFieldByName(customFieldName)
              : viewModel.addEditCustomFieldByName(customFieldName);

          if (!result.ok) {
            setCustomFieldModalError(
              result.reason === 'EMPTY' ? t('customFields.errorEmpty') : t('customFields.errorDuplicate')
            );
            return;
          }

          setIsCustomFieldModalOpen(false);
          setCustomFieldModalError(null);
        }}
      />

      <CustomFieldRenameModal
        isOpen={isRenameModalOpen}
        name={renameName}
        error={renameError}
        onChangeName={(value) => {
          setRenameName(value);
          setRenameError(null);
        }}
        onCancel={() => {
          setIsRenameModalOpen(false);
          setRenameError(null);
        }}
        onOk={() => {
          if (!renameTargetRowId || !renameTargetDialogId) {
            setIsRenameModalOpen(false);
            setRenameError(null);
            return;
          }

          const result =
            renameTargetDialogId === 'datacard-create-dialog'
              ? viewModel.renameCreateCustomFieldById(renameTargetRowId, renameName)
              : viewModel.renameEditCustomFieldById(renameTargetRowId, renameName);
          if (!result.ok) {
            setRenameError(
              result.reason === 'EMPTY' ? t('customFields.errorEmpty') : t('customFields.errorDuplicate')
            );
            return;
          }

          setIsRenameModalOpen(false);
          setRenameError(null);
          setRenameTargetRowId(null);
          setRenameTargetDialogId(null);
        }}
      />

      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        generatedPassword={generatedPassword}
        charsetSize={charsetSize}
        options={generatorOptions}
        onChangeOptions={setGeneratorOptions}
        onClose={closeGenerator}
        onUse={handleUseGeneratedPassword}
        onRegenerate={() => regeneratePassword(generatorOptions)}
        onCopy={handleCopyGeneratedPassword}
      />

      <Add2FAModal
        isOpen={is2faModalOpen}
        existingUri={
          twoFactorTargetDialogId === 'datacard-create-dialog'
            ? (viewModel.createForm.totpUri.trim() ? viewModel.createForm.totpUri : null)
            : (viewModel.editForm?.totpUri?.trim() ? viewModel.editForm.totpUri : null)
        }
        defaults={{
          issuer:
            twoFactorTargetDialogId === 'datacard-create-dialog'
              ? ((viewModel.createForm.title ?? 'Vault').trim() || 'Vault')
              : ((viewModel.editForm?.title ?? 'Vault').trim() || 'Vault'),
          label:
            twoFactorTargetDialogId === 'datacard-create-dialog'
              ? ((viewModel.createForm.title ?? 'Account').trim() || 'Account')
              : ((viewModel.editForm?.title ?? 'Account').trim() || 'Account'),
        }}
        onCancel={() => {
          setIs2faModalOpen(false);
          setTwoFactorTargetDialogId(null);
        }}
        onSave={(uri) => {
          if (twoFactorTargetDialogId === 'datacard-create-dialog') {
            viewModel.updateCreateField('totpUri', uri);
          } else {
            viewModel.updateEditField('totpUri', uri);
          }
          setIs2faModalOpen(false);
          setTwoFactorTargetDialogId(null);
        }}
        onRemove={() => {
          if (twoFactorTargetDialogId === 'datacard-create-dialog') {
            viewModel.updateCreateField('totpUri', '');
          } else {
            viewModel.updateEditField('totpUri', '');
          }
          setIs2faModalOpen(false);
          setTwoFactorTargetDialogId(null);
        }}
      />
    </div>
  );
}
