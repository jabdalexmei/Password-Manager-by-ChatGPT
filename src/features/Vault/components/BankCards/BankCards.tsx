import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { BankCardFieldErrors, BankCardFormState, BankCardsViewModel } from './useBankCardsViewModel';
import type { Folder } from '../../types/ui';
import { FolderSelect } from '../shared/FolderSelect';
import { VaultSortControl } from '../shared/VaultSortControl';
import {
  getVaultSortMode,
  setVaultSortMode,
  sortBankCardSummaries,
  type VaultSortMode,
} from '../../lib/vaultSort';
import { IconMoreHorizontal } from '@/shared/icons/lucide/icons';

export type BankCardsProps = {
  profileId: string;
  viewModel: BankCardsViewModel;
  sectionTitle: string;
  folders: Folder[];
  /**
   * When true, the panel stretches to fill the center column height.
   * This is desired for single-panel views (Category-only), so the list can scroll
   * and the empty state can be vertically centered.
   */
  fillHeight?: boolean;
  /**
   * When BankCards is rendered as part of a combined view (e.g. global Deleted),
   * the parent can render a single actions menu and suppress the per-section one.
   */
  showTrashActions?: boolean;
  /**
   * In combined views (Navigation/Folders), the parent may want to render a single
   * global empty state instead of per-section "Empty" blocks. This flag suppresses
   * the per-section empty placeholder while keeping dialogs functional.
   */
  suppressEmptyState?: boolean;
};

export function BankCards({
  profileId,
  viewModel,
  sectionTitle,
  folders,
  fillHeight = true,
  showTrashActions = true,
  suppressEmptyState = false,
}: BankCardsProps) {
  const { t } = useTranslation('BankCards');
  const { t: tCommon } = useTranslation('Common');
  const {
    cards: rawCards,
    selectedCardId,
    isTrashMode,
    isCreateOpen,
    isEditOpen,
    isCreateSubmitting,
    isEditSubmitting,
    closeCreateModal,
  } = viewModel;
  const [sortMode, setSortMode] = useState<VaultSortMode>(() => getVaultSortMode('bank_cards', profileId));

  useEffect(() => {
    setSortMode(getVaultSortMode('bank_cards', profileId));
  }, [profileId]);

  useEffect(() => {
    setVaultSortMode('bank_cards', profileId, sortMode);
  }, [profileId, sortMode]);

  const cards = useMemo(() => sortBankCardSummaries(rawCards, sortMode), [rawCards, sortMode]);
  const [isTrashActionsOpen, setIsTrashActionsOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState<null | { id: string; x: number; y: number }>(null);
  const shouldShowTrashActions = isTrashMode && showTrashActions;
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

          <form className="dialog-body" onSubmit={handleSubmit} autoComplete="off">
            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-title-input`}>
                {t('label.title')}
              </label>
              <input
                id={`${dialogId}-title-input`}
                className="input"
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
                rows={4}
                value={form.note}
                onChange={(e) => onFieldChange('note', e.target.value)}
                placeholder={t('label.notePlaceholder')}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-folder-input`}>
                {t('label.folder')}
              </label>
              <FolderSelect
                id={`${dialogId}-folder-input`}
                value={form.folderId ?? null}
                noneLabel={t('label.folderRoot')}
                options={folders
                  .filter((folder) => !folder.isSystem && !folder.deletedAt)
                  .map((folder) => ({ id: folder.id, name: folder.name }))}
                onChange={(folderId) => onFieldChange('folderId', folderId ?? '')}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor={`${dialogId}-tags-input`}>
                {t('label.tags')}
              </label>
              <input
                id={`${dialogId}-tags-input`}
                className="input"
                autoComplete="off"
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

  const emptyLabel = (() => {
    const v = t('label.empty');
    return v === 'label.empty' ? tCommon('label.empty') : v;
  })();

  const hasAnyOverlayOpen = isCreateOpen || isEditOpen;
  if (suppressEmptyState && cards.length === 0 && !hasAnyOverlayOpen) {
    return null;
  }

  return (
    <div className={`vault-panel-wrapper ${fillHeight ? 'vault-panel-wrapper--fill' : ''}`.trim()}>
      {cardMenu && !viewModel.isTrashMode && (
        <>
          <div
            className="vault-actionmenu-backdrop"
            onClick={() => setCardMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setCardMenu(null);
            }}
          />
          <div
            className="vault-actionmenu-panel vault-contextmenu-panel"
            role="menu"
            style={
              {
                '--menu-x': `${cardMenu.x}px`,
                '--menu-y': `${cardMenu.y}px`,
              } as React.CSSProperties
            }
          >
            {(() => {
              const target = cards.find((card) => card.id === cardMenu.id) ?? null;
              const isArchived = Boolean(target?.archivedAt);
              const isFavorite = Boolean(target?.isFavorite);

              return (
                <>
                  <button
                    className="vault-actionmenu-item"
                    type="button"
                    onClick={async () => {
                      const id = cardMenu.id;
                      setCardMenu(null);
                      try {
                        const backend = await import('../../api/vaultApi').then((module) =>
                          module.getBankCard(id)
                        );
                        const mapped = await import('../../types/mappers').then((module) =>
                          module.mapBankCardFromBackend(backend)
                        );
                        viewModel.openEditModal(mapped);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  >
                    {t('action.edit')}
                  </button>

                  <button
                    className="vault-actionmenu-item"
                    type="button"
                    onClick={async () => {
                      const id = cardMenu.id;
                      setCardMenu(null);
                      await viewModel.toggleFavorite(id);
                    }}
                  >
                    {isFavorite ? t('action.unmarkFavorite') : t('action.markFavorite')}
                  </button>

                  <button
                    className="vault-actionmenu-item"
                    type="button"
                    onClick={async () => {
                      const id = cardMenu.id;
                      setCardMenu(null);
                      await viewModel.toggleArchive(id);
                    }}
                  >
                    {isArchived ? t('action.unarchive') : t('action.archive')}
                  </button>

                  <button
                    className="vault-actionmenu-item vault-actionmenu-danger"
                    type="button"
                    onClick={async () => {
                      const id = cardMenu.id;
                      setCardMenu(null);
                      await viewModel.deleteCard(id);
                    }}
                  >
                    {t('action.delete')}
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
      <div className="datacards-header">
        <div className="vault-section-header">{sectionTitle}</div>

        <div className="datacards-header__right">
          <VaultSortControl value={sortMode} onChange={setSortMode} disabled={cards.length < 2} />

          {shouldShowTrashActions ? (
            <div className="datacards-actions">
              <button
                className="btn btn-icon vault-actionbar"
                type="button"
                aria-label={t('trash.actions')}
                aria-haspopup="menu"
                aria-expanded={isTrashActionsOpen}
                onClick={() => setIsTrashActionsOpen((prev) => !prev)}
              >
                <IconMoreHorizontal className="vault-actionbar-icon" size={18} />
              </button>

              {isTrashActionsOpen && (
                <>
                  <div
                    className="vault-actionmenu-backdrop"
                    onClick={() => setIsTrashActionsOpen(false)}
                  />
                  <div className="vault-actionmenu-panel" role="menu">
                    <button
                      className="vault-actionmenu-item"
                      type="button"
                      disabled={viewModel.isTrashBulkSubmitting || viewModel.cards.length === 0}
                      onClick={async () => {
                        setIsTrashActionsOpen(false);
                        await viewModel.restoreAllTrash();
                      }}
                    >
                      {t('trash.restoreAll')}
                    </button>

                    <button
                      className="vault-actionmenu-item vault-actionmenu-danger"
                      type="button"
                      disabled={viewModel.isTrashBulkSubmitting || viewModel.cards.length === 0}
                      onClick={async () => {
                        setIsTrashActionsOpen(false);
                        await viewModel.purgeAllTrash();
                      }}
                    >
                      {t('trash.removeAll')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {cards.length === 0 ? (
        suppressEmptyState ? null : (
          <div className="vault-datacard-list vault-datacard-list--empty">
            <div className="vault-empty">{emptyLabel}</div>
          </div>
        )
      ) : (
        <div className="vault-datacard-list">
          {cards.map((card) => {
            const isActive = selectedCardId === card.id;
            const isFavorite = card.isFavorite;
            const title = card.title?.trim() ? card.title : t('label.untitled');

            return (
              <button
                key={card.id}
                className={`vault-datacard ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => viewModel.selectCard(card.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  viewModel.selectCard(card.id);
                  setCardMenu({ id: card.id, x: event.clientX, y: event.clientY });
                }}
              >
                <div className="datacard-top">
                  <div className="datacard-title">{title}</div>
                  {isFavorite && <span className="pill datacard-favorite">{t('label.favorite')}</span>}
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
