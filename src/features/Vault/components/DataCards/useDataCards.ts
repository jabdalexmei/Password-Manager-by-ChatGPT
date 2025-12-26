import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { useToaster } from '../../../../components/Toaster';
import {
  CreateDataCardInput,
  CustomField,
  CustomFieldType,
  DataCard,
  DataCardSummary,
  Folder,
  UpdateDataCardInput,
} from '../../types/ui';

type CustomFieldFormRow = {
  id: string;
  key: string;
  value: string;
  type: CustomFieldType;
};

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
  totpUri: string;
  customFields: CustomFieldFormRow[];
};

type UseDataCardsParams = {
  cards: DataCardSummary[];
  selectedCardId: string | null;
  isTrashMode: boolean;
  folders: Folder[];
  defaultFolderId: string | null;
  onSelectCard: (id: string) => void;
  onCreateCard: (input: CreateDataCardInput) => Promise<DataCard | void | null>;
  onUploadAttachments: (cardId: string, paths: string[]) => Promise<string[]>;
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
  createAttachments: PendingAttachment[];
  addCreateAttachments: (paths: string[]) => void;
  removeCreateAttachment: (path: string) => void;
  addCreateCustomFieldByName: (name: string) => { ok: true } | { ok: false; reason: 'EMPTY' | 'DUPLICATE' };
  updateCreateCustomFieldValue: (rowId: string, value: string) => void;
  addEditCustomFieldByName: (name: string) => { ok: true } | { ok: false; reason: 'EMPTY' | 'DUPLICATE' };
  updateEditCustomFieldValue: (rowId: string, value: string) => void;
  renameEditCustomFieldById: (
    rowId: string,
    nextName: string
  ) => { ok: true } | { ok: false; reason: 'EMPTY' | 'DUPLICATE' };
  removeEditCustomFieldById: (rowId: string) => void;
};

type PendingAttachment = {
  path: string;
  name: string;
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

const makeRowId = () =>
  globalThis.crypto?.randomUUID?.() ?? `cf_${Date.now()}_${Math.random().toString(16).slice(2)}`;

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
  totpUri: normalizeOptional(form.totpUri),
  customFields: form.customFields.map((row) => ({
    key: row.key,
    value: row.value,
    type: row.type,
  })),
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
  totpUri: '',
  customFields: [],
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
  onUploadAttachments,
  onUpdateCard,
  onDeleteCard,
  onRestoreCard,
  onPurgeCard,
}: UseDataCardsParams): DataCardsViewModel {
  const { t } = useTranslation('DataCards');
  const { show: showToast } = useToaster();
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
  const [createAttachments, setCreateAttachments] = useState<PendingAttachment[]>([]);

  const resetCreateForm = useCallback(() => {
    const folderName = findFolderName(defaultFolderId, folders);
    setCreateForm(buildInitialForm(defaultFolderId, folderName));
  }, [defaultFolderId, folders]);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    setCreateFolderError(null);
    setIsCreateSubmitting(false);
    resetCreateForm();
    setCreateAttachments([]);
    setCreateOpen(true);
    setShowPassword(true);
  }, [resetCreateForm]);

  const closeCreateModal = useCallback(() => {
    setIsCreateSubmitting(false);
    setCreateOpen(false);
    setCreateAttachments([]);
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
      totpUri: card.totpUri || '',
      mobilePhone: card.mobilePhone || '',
      note: card.note || '',
      tagsText: (card.tags || []).join(', '),
      customFields: (card.customFields ?? []).map((field: CustomField) => ({
        id: makeRowId(),
        key: field.key,
        value: field.value,
        type: field.type,
      })),
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

  const addCreateAttachments = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setCreateAttachments((prev) => {
      const existing = new Set(prev.map((p) => p.path));
      const next = [...prev];
      paths.forEach((path) => {
        if (existing.has(path)) return;
        const parts = path.split(/[/\\]/);
        const name = parts[parts.length - 1] || path;
        next.push({ path, name });
      });
      return next;
    });
  }, []);

  const removeCreateAttachment = useCallback((path: string) => {
    setCreateAttachments((prev) => prev.filter((item) => item.path !== path));
  }, []);

  const addCreateCustomFieldByName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false as const, reason: 'EMPTY' as const };

      const exists = createForm.customFields.some(
        (row) => row.key.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) return { ok: false as const, reason: 'DUPLICATE' as const };

      setCreateForm((prev) => ({
        ...prev,
        customFields: [...prev.customFields, { id: makeRowId(), key: trimmed, value: '', type: 'text' }],
      }));

      return { ok: true as const };
    },
    [createForm.customFields]
  );

  const updateCreateCustomFieldValue = useCallback((rowId: string, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((row) => (row.id === rowId ? { ...row, value } : row)),
    }));
  }, []);

  const addEditCustomFieldByName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false as const, reason: 'EMPTY' as const };

      const exists = (editForm?.customFields ?? []).some(
        (row) => row.key.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) return { ok: false as const, reason: 'DUPLICATE' as const };

      setEditForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          customFields: [...prev.customFields, { id: makeRowId(), key: trimmed, value: '', type: 'text' }],
        };
      });

      return { ok: true as const };
    },
    [editForm]
  );

  const updateEditCustomFieldValue = useCallback((rowId: string, value: string) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customFields: prev.customFields.map((row) => (row.id === rowId ? { ...row, value } : row)),
      };
    });
  }, []);

  const renameEditCustomFieldById = useCallback(
    (rowId: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) return { ok: false as const, reason: 'EMPTY' as const };

      const exists = (editForm?.customFields ?? []).some((row) => {
        if (row.id === rowId) return false;
        return row.key.trim().toLowerCase() === trimmed.toLowerCase();
      });

      if (exists) return { ok: false as const, reason: 'DUPLICATE' as const };

      setEditForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          customFields: prev.customFields.map((row) => (row.id === rowId ? { ...row, key: trimmed } : row)),
        };
      });

      return { ok: true as const };
    },
    [editForm]
  );

  const removeEditCustomFieldById = useCallback((rowId: string) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customFields: prev.customFields.filter((row) => row.id !== rowId),
      };
    });
  }, []);

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
      const created = await onCreateCard(buildCreateInput(createForm));

      if (created && createAttachments.length > 0) {
        const failed = await onUploadAttachments(
          created.id,
          createAttachments.map((item) => item.path)
        );
        if (failed.length > 0) {
          showToast(t('toast.attachmentUploadError'), 'error');
        }
      }

      if (created) {
        setCreateOpen(false);
        resetCreateForm();
        setCreateAttachments([]);
      }
    } finally {
      setIsCreateSubmitting(false);
    }
  }, [
    createAttachments,
    createForm,
    isCreateSubmitting,
    onCreateCard,
    onUploadAttachments,
    resetCreateForm,
    showToast,
    t,
  ]);

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
    createAttachments,
    addCreateAttachments,
    removeCreateAttachment,
    addCreateCustomFieldByName,
    updateCreateCustomFieldValue,
    addEditCustomFieldByName,
    updateEditCustomFieldValue,
    renameEditCustomFieldById,
    removeEditCustomFieldById,
  };
}
