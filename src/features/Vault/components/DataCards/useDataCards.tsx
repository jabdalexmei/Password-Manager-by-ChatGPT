import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { CreateDataCardInput, DataCard, Folder, UpdateDataCardInput } from '../../types/ui';

type FormState = {
  title: string;
  folderId: string | null;
  url: string;
  email: string;
  username: string;
  password: string;
  mobilePhone: string;
  note: string;
  tagsText: string;
};

type UseDataCardsParams = {
  cards: DataCard[];
  selectedCardId: string | null;
  isTrashMode: boolean;
  folders: Folder[];
  defaultFolderId: string | null;
  onSelectCard: (id: string) => void;
  onCreateCard: (input: CreateDataCardInput) => Promise<DataCard | void | null>;
  onUpdateCard: (input: UpdateDataCardInput) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void> | void;
  onRestoreCard: (id: string) => Promise<void> | void;
  onPurgeCard: (id: string) => Promise<void> | void;
};

export type DataCardsViewModel = {
  cards: DataCard[];
  selectedCardId: string | null;
  isTrashMode: boolean;
  selectCard: (id: string) => void;
  deleteCard: (id: string) => void;
  restoreCard: (id: string) => void;
  purgeCard: (id: string) => void;
  openCreateModal: () => void;
  openEditModal: (card: DataCard) => void;
  dialogs: JSX.Element | null;
};

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeTags = (value: string) => {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
};

const buildCreateInput = (form: FormState): CreateDataCardInput => ({
  folderId: form.folderId,
  title: form.title.trim(),
  url: normalizeOptional(form.url),
  email: normalizeOptional(form.email),
  username: normalizeOptional(form.username),
  password: normalizeOptional(form.password),
  mobilePhone: normalizeOptional(form.mobilePhone),
  note: normalizeOptional(form.note),
  tags: normalizeTags(form.tagsText),
});

const buildUpdateInput = (form: FormState, id: string): UpdateDataCardInput => ({
  id,
  ...buildCreateInput(form),
});

export function useDataCards({
  cards,
  selectedCardId,
  isTrashMode,
  folders,
  defaultFolderId,
  onSelectCard,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onRestoreCard,
  onPurgeCard,
}: UseDataCardsParams): DataCardsViewModel {
  const { t } = useTranslation('DataCards');
  const [createForm, setCreateForm] = useState<FormState>(() => ({
    title: '',
    folderId: defaultFolderId,
    url: '',
    email: '',
    username: '',
    password: '',
    mobilePhone: '',
    note: '',
    tagsText: '',
  }));
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const resetCreateForm = useCallback(
    () =>
      setCreateForm({
        title: '',
        folderId: defaultFolderId,
        url: '',
        email: '',
        username: '',
        password: '',
        mobilePhone: '',
        note: '',
        tagsText: '',
      }),
    [defaultFolderId]
  );

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    resetCreateForm();
    setCreateOpen(true);
  }, [resetCreateForm]);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const openEditModal = useCallback((card: DataCard) => {
    setEditError(null);
    setEditCardId(card.id);
    setEditForm({
      title: card.title,
      folderId: card.folderId,
      url: card.url || '',
      email: card.email || '',
      username: card.username || '',
      password: card.password || '',
      mobilePhone: card.mobilePhone || '',
      note: card.note || '',
      tagsText: (card.tags || []).join(', '),
    });
    setEditOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    setEditForm(null);
    setEditCardId(null);
  }, []);

  const updateCreateField = useCallback(
    (field: keyof FormState, value: string | null) => {
      setCreateForm((prev) => ({ ...prev, [field]: value ?? '' }));
    },
    []
  );

  const updateEditField = useCallback(
    (field: keyof FormState, value: string | null) => {
      setEditForm((prev) => (prev ? { ...prev, [field]: value ?? '' } : prev));
    },
    []
  );

  const submitCreate = useCallback(async () => {
    const trimmedTitle = createForm.title.trim();
    if (!trimmedTitle) {
      setCreateError(t('validation.titleRequired'));
      return;
    }

    await onCreateCard(buildCreateInput(createForm));
    setCreateOpen(false);
    resetCreateForm();
  }, [createForm, onCreateCard, resetCreateForm, t]);

  const submitEdit = useCallback(async () => {
    if (!editForm) return;
    const trimmedTitle = editForm.title.trim();
    if (!trimmedTitle) {
      setEditError(t('validation.titleRequired'));
      return;
    }

    if (!editCardId) return;

    await onUpdateCard(buildUpdateInput(editForm, editCardId));
    setEditOpen(false);
    setEditForm(null);
    setEditCardId(null);
  }, [editCardId, editForm, onUpdateCard, t]);

  const dialogs = useMemo(
    () => (
      <>
        {isCreateOpen && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('dialog.createTitle')}</h3>
              <label>
                {t('label.title')}*
                <input
                  value={createForm.title}
                  onChange={(e) => updateCreateField('title', e.target.value)}
                />
              </label>
              {createError && <div className="form-error">{createError}</div>}
              <label>
                {t('label.folder')}
                <select
                  value={createForm.folderId ?? ''}
                  onChange={(e) => updateCreateField('folderId', e.target.value || null)}
                >
                  <option value="">{t('label.noFolder')}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('label.username')}
                <input
                  value={createForm.username}
                  onChange={(e) => updateCreateField('username', e.target.value)}
                />
              </label>
              <label>
                {t('label.email')}
                <input value={createForm.email} onChange={(e) => updateCreateField('email', e.target.value)} />
              </label>
              <label>
                {t('label.url')}
                <input value={createForm.url} onChange={(e) => updateCreateField('url', e.target.value)} />
              </label>
              <label>
                {t('label.password')}
                <input value={createForm.password} onChange={(e) => updateCreateField('password', e.target.value)} />
              </label>
              <label>
                {t('label.mobile')}
                <input
                  value={createForm.mobilePhone}
                  onChange={(e) => updateCreateField('mobilePhone', e.target.value)}
                />
              </label>
              <label>
                {t('label.note')}
                <textarea value={createForm.note} onChange={(e) => updateCreateField('note', e.target.value)} />
              </label>
              <label>
                {t('label.tagsPlaceholder')}
                <input
                  value={createForm.tagsText}
                  onChange={(e) => updateCreateField('tagsText', e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button className="btn btn-primary" type="button" onClick={submitCreate}>
                  {t('action.create')}
                </button>
                <button className="btn" type="button" onClick={closeCreateModal}>
                  {t('action.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {isEditOpen && editForm && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('dialog.editTitle')}</h3>
              <label>
                {t('label.title')}*
                <input value={editForm.title} onChange={(e) => updateEditField('title', e.target.value)} />
              </label>
              {editError && <div className="form-error">{editError}</div>}
              <label>
                {t('label.folder')}
                <select
                  value={editForm.folderId ?? ''}
                  onChange={(e) => updateEditField('folderId', e.target.value || null)}
                >
                  <option value="">{t('label.noFolder')}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('label.username')}
                <input value={editForm.username} onChange={(e) => updateEditField('username', e.target.value)} />
              </label>
              <label>
                {t('label.email')}
                <input value={editForm.email} onChange={(e) => updateEditField('email', e.target.value)} />
              </label>
              <label>
                {t('label.url')}
                <input value={editForm.url} onChange={(e) => updateEditField('url', e.target.value)} />
              </label>
              <label>
                {t('label.password')}
                <input value={editForm.password} onChange={(e) => updateEditField('password', e.target.value)} />
              </label>
              <label>
                {t('label.mobile')}
                <input value={editForm.mobilePhone} onChange={(e) => updateEditField('mobilePhone', e.target.value)} />
              </label>
              <label>
                {t('label.note')}
                <textarea value={editForm.note} onChange={(e) => updateEditField('note', e.target.value)} />
              </label>
              <label>
                {t('label.tagsPlaceholder')}
                <input value={editForm.tagsText} onChange={(e) => updateEditField('tagsText', e.target.value)} />
              </label>
              <div className="modal-actions">
                <button className="btn btn-primary" type="button" onClick={submitEdit}>
                  {t('action.save')}
                </button>
                <button className="btn" type="button" onClick={closeEditModal}>
                  {t('action.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    ),
    [
      createError,
      createForm,
      editError,
      editForm,
      folders,
      isCreateOpen,
      isEditOpen,
      submitCreate,
      submitEdit,
      t,
      updateCreateField,
      updateEditField,
      closeCreateModal,
      closeEditModal,
    ]
  );

  return {
    cards,
    selectedCardId,
    isTrashMode,
    selectCard: onSelectCard,
    deleteCard: onDeleteCard,
    restoreCard: onRestoreCard,
    purgeCard: onPurgeCard,
    openCreateModal,
    openEditModal,
    dialogs,
  };
}
