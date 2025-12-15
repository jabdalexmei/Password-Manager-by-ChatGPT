import { useCallback, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { CreateDataCardInput, DataCard, Folder, UpdateDataCardInput } from '../../types/ui';

export type DataCardFormState = {
  title: string;
  folderId: string | null;
  url: string;
  email: string;
  username: string;
  password: string;
  mobilePhone: string;
  note: string;
  tagsText: string;
  isFavorite: boolean;
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
  closeCreateModal: () => void;
  openEditModal: (card: DataCard) => void;
  closeEditModal: () => void;
  isCreateOpen: boolean;
  isEditOpen: boolean;
  createForm: DataCardFormState;
  editForm: DataCardFormState | null;
  createError: string | null;
  editError: string | null;
  updateCreateField: (field: keyof DataCardFormState, value: string | boolean | null) => void;
  updateEditField: (field: keyof DataCardFormState, value: string | boolean | null) => void;
  submitCreate: () => Promise<void>;
  submitEdit: () => Promise<void>;
  folders: Folder[];
};

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeTags = (value: string, isFavorite: boolean) => {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const tagSet = new Set(tags);
  if (isFavorite) {
    tagSet.add('favorite');
  } else {
    tagSet.delete('favorite');
  }

  return Array.from(tagSet);
};

const buildCreateInput = (form: DataCardFormState): CreateDataCardInput => ({
  folderId: form.folderId,
  title: form.title.trim(),
  url: normalizeOptional(form.url),
  email: normalizeOptional(form.email),
  username: normalizeOptional(form.username),
  password: normalizeOptional(form.password),
  mobilePhone: normalizeOptional(form.mobilePhone),
  note: normalizeOptional(form.note),
  tags: normalizeTags(form.tagsText, form.isFavorite),
});

const buildUpdateInput = (form: DataCardFormState, id: string): UpdateDataCardInput => ({
  id,
  ...buildCreateInput(form),
});

const buildInitialForm = (defaultFolderId: string | null): DataCardFormState => ({
  title: '',
  folderId: defaultFolderId,
  url: '',
  email: '',
  username: '',
  password: '',
  mobilePhone: '',
  note: '',
  tagsText: '',
  isFavorite: false,
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
  const [createForm, setCreateForm] = useState<DataCardFormState>(() => buildInitialForm(defaultFolderId));
  const [editForm, setEditForm] = useState<DataCardFormState | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const resetCreateForm = useCallback(() => {
    setCreateForm(buildInitialForm(defaultFolderId));
  }, [defaultFolderId]);

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
      tagsText: (card.tags || []).filter((tag) => tag !== 'favorite').join(', '),
      isFavorite: (card.tags || []).includes('favorite'),
    });
    setEditOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    setEditForm(null);
    setEditCardId(null);
  }, []);

  const updateCreateField = useCallback((field: keyof DataCardFormState, value: string | boolean | null) => {
    setCreateForm((prev) => {
      if (field === 'isFavorite') {
        return { ...prev, isFavorite: Boolean(value) };
      }

      return { ...prev, [field]: (value ?? '') as string };
    });
  }, []);

  const updateEditField = useCallback((field: keyof DataCardFormState, value: string | boolean | null) => {
    setEditForm((prev) => {
      if (!prev) return prev;

      if (field === 'isFavorite') {
        return { ...prev, isFavorite: Boolean(value) };
      }

      return { ...prev, [field]: (value ?? '') as string };
    });
  }, []);

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

  return {
    cards,
    selectedCardId,
    isTrashMode,
    selectCard: onSelectCard,
    deleteCard: onDeleteCard,
    restoreCard: onRestoreCard,
    purgeCard: onPurgeCard,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    isCreateOpen,
    isEditOpen,
    createForm,
    editForm,
    createError,
    editError,
    updateCreateField,
    updateEditField,
    submitCreate,
    submitEdit,
    folders,
  };
}
