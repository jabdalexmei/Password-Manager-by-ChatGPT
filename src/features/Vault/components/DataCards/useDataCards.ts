import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { CreateDataCardInput, DataCard, DataCardSummary, Folder, UpdateDataCardInput } from '../../types/ui';

export type DataCardFormState = {
  title: string;
  folderId: string | null;
  folderName: string;
  url: string;
  email: string;
  username: string;
  password: string;
  mobilePhone: string;
  note: string;
  tagsText: string;
};

type UseDataCardsParams = {
  cards: DataCardSummary[];
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
  cards: DataCardSummary[];
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
  createFolderError: string | null;
  editFolderError: string | null;
  isCreateSubmitting: boolean;
  isEditSubmitting: boolean;
  updateCreateField: (field: keyof DataCardFormState, value: string | boolean | null) => void;
  updateEditField: (field: keyof DataCardFormState, value: string | boolean | null) => void;
  submitCreate: () => Promise<void>;
  submitEdit: () => Promise<void>;
  folders: Folder[];
  showPassword: boolean;
  togglePasswordVisibility: () => void;
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

  const tagSet = new Set(tags);

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
  tags: normalizeTags(form.tagsText),
});

const buildUpdateInput = (form: DataCardFormState, id: string): UpdateDataCardInput => ({
  id,
  ...buildCreateInput(form),
});

const buildInitialForm = (defaultFolderId: string | null, folderName: string): DataCardFormState => ({
  title: '',
  folderId: defaultFolderId,
  folderName,
  url: '',
  email: '',
  username: '',
  password: '',
  mobilePhone: '',
  note: '',
  tagsText: '',
});

const findFolderName = (folderId: string | null, folderList: Folder[]) => {
  if (!folderId) return '';
  return folderList.find((folder) => folder.id === folderId)?.name ?? '';
};

const findFolderIdByName = (name: string, folderList: Folder[]) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const match = folderList.find((folder) => !folder.isSystem && folder.name.toLowerCase() === normalized);
  return match ? match.id : null;
};

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
  const [createForm, setCreateForm] = useState<DataCardFormState>(() =>
    buildInitialForm(defaultFolderId, findFolderName(defaultFolderId, folders))
  );
  const [editForm, setEditForm] = useState<DataCardFormState | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [editFolderError, setEditFolderError] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const resetCreateForm = useCallback(() => {
    const folderName = findFolderName(defaultFolderId, folders);
    setCreateForm(buildInitialForm(defaultFolderId, folderName));
  }, [defaultFolderId, folders]);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    setCreateFolderError(null);
    setIsCreateSubmitting(false);
    resetCreateForm();
    setCreateOpen(true);
    setShowPassword(true);
  }, [resetCreateForm]);

  const closeCreateModal = useCallback(() => {
    setIsCreateSubmitting(false);
    setCreateOpen(false);
  }, []);

  const openEditModal = useCallback((card: DataCard) => {
    setEditError(null);
    setEditFolderError(null);
    setIsEditSubmitting(false);
    setEditCardId(card.id);
    setEditForm({
      title: card.title,
      folderId: card.folderId,
      folderName: findFolderName(card.folderId, folders),
      url: card.url || '',
      email: card.email || '',
      username: card.username || '',
      password: card.password || '',
      mobilePhone: card.mobilePhone || '',
      note: card.note || '',
      tagsText: (card.tags || []).join(', '),
    });
    setEditOpen(true);
    setShowPassword(false);
  }, [folders]);

  const closeEditModal = useCallback(() => {
    setIsEditSubmitting(false);
    setEditOpen(false);
    setEditForm(null);
    setEditCardId(null);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isCreateOpen && !isEditOpen) {
      setShowPassword(false);
    }
  }, [isCreateOpen, isEditOpen]);

  const updateCreateField = useCallback(
    (field: keyof DataCardFormState, value: string | boolean | null) => {
      if (field === 'title') {
        setCreateError(null);
      }
      if (field === 'folderName') {
        setCreateFolderError(null);
      }
      setCreateForm((prev) => {
        if (field === 'folderId') {
          return { ...prev, folderId: value === '' ? null : (value as string | null) };
        }

        if (field === 'folderName') {
          const name = (value ?? '') as string;
          const matchedId = name.trim() ? findFolderIdByName(name, folders) : null;
          return { ...prev, folderName: name, folderId: matchedId };
        }

        return { ...prev, [field]: (value ?? '') as string };
      });
    },
    [folders]
  );

  const updateEditField = useCallback(
    (field: keyof DataCardFormState, value: string | boolean | null) => {
      setEditForm((prev) => {
        if (!prev) return prev;

        if (field === 'title') {
          setEditError(null);
        }
        if (field === 'folderName') {
          setEditFolderError(null);
        }

        if (field === 'folderId') {
          return { ...prev, folderId: value === '' ? null : (value as string | null) };
        }

        if (field === 'folderName') {
          const name = (value ?? '') as string;
          const matchedId = name.trim() ? findFolderIdByName(name, folders) : null;
          return { ...prev, folderName: name, folderId: matchedId };
        }

        return { ...prev, [field]: (value ?? '') as string };
      });
    },
    [folders]
  );

  const submitCreate = useCallback(async () => {
    if (isCreateSubmitting) return;
    const trimmedTitle = createForm.title.trim();
    if (!trimmedTitle) {
      setCreateError(t('validation.titleRequired'));
      return;
    }

    setCreateFolderError(null);
    const hasFolderName = createForm.folderName.trim() !== '';
    if (hasFolderName && createForm.folderId === null) {
      setCreateFolderError(t('validation.folderNotFound'));
      return;
    }

    setIsCreateSubmitting(true);
    try {
      await onCreateCard(buildCreateInput(createForm));
      setCreateOpen(false);
      resetCreateForm();
    } finally {
      setIsCreateSubmitting(false);
    }
  }, [createForm, isCreateSubmitting, onCreateCard, resetCreateForm, t]);

  const submitEdit = useCallback(async () => {
    if (isEditSubmitting) return;
    if (!editForm) return;
    const trimmedTitle = editForm.title.trim();
    if (!trimmedTitle) {
      setEditError(t('validation.titleRequired'));
      return;
    }

    if (!editCardId) return;

    setEditFolderError(null);
    const hasFolderName = editForm.folderName.trim() !== '';
    if (hasFolderName && editForm.folderId === null) {
      setEditFolderError(t('validation.folderNotFound'));
      return;
    }

    setIsEditSubmitting(true);
    try {
      await onUpdateCard(buildUpdateInput(editForm, editCardId));
      setEditOpen(false);
      setEditForm(null);
      setEditCardId(null);
    } finally {
      setIsEditSubmitting(false);
    }
  }, [editCardId, editForm, isEditSubmitting, onUpdateCard, t]);

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
    createFolderError,
    editFolderError,
    isCreateSubmitting,
    isEditSubmitting,
    updateCreateField,
    updateEditField,
    submitCreate,
    submitEdit,
    folders,
    showPassword,
    togglePasswordVisibility,
  };
}
