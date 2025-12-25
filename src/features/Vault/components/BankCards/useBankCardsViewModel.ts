import { useCallback, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { BankCardItem, BankCardSummary, CreateBankCardInput, UpdateBankCardInput } from '../../types/ui';

export type BankCardFormState = {
  title: string;
  holder: string;
  number: string;
  expiryMmYy: string;
  cvc: string;
  note: string;
  tagsText: string;
};

type UseBankCardsParams = {
  cards: BankCardSummary[];
  selectedCardId: string | null;
  isTrashMode: boolean;
  onSelectCard: (id: string | null) => void;
  onCreateCard: (input: CreateBankCardInput) => Promise<BankCardItem | void | null>;
  onUpdateCard: (input: UpdateBankCardInput) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void> | void;
  onRestoreCard: (id: string) => Promise<void> | void;
  onPurgeCard: (id: string) => Promise<void> | void;
};

export type BankCardsViewModel = {
  cards: BankCardSummary[];
  selectedCardId: string | null;
  isTrashMode: boolean;
  selectCard: (id: string) => void;
  deleteCard: (id: string) => void;
  restoreCard: (id: string) => void;
  purgeCard: (id: string) => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (card: BankCardItem) => void;
  closeEditModal: () => void;
  isCreateOpen: boolean;
  isEditOpen: boolean;
  createForm: BankCardFormState;
  editForm: BankCardFormState | null;
  createError: string | null;
  editError: string | null;
  isCreateSubmitting: boolean;
  isEditSubmitting: boolean;
  updateCreateField: (field: keyof BankCardFormState, value: string) => void;
  updateEditField: (field: keyof BankCardFormState, value: string) => void;
  submitCreate: () => Promise<void>;
  submitEdit: () => Promise<void>;
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

const buildCreateInput = (form: BankCardFormState): CreateBankCardInput => ({
  title: form.title.trim(),
  holder: normalizeOptional(form.holder),
  number: normalizeOptional(form.number),
  expiryMmYy: normalizeOptional(form.expiryMmYy),
  cvc: normalizeOptional(form.cvc),
  note: normalizeOptional(form.note),
  tags: normalizeTags(form.tagsText),
});

const buildUpdateInput = (form: BankCardFormState, id: string): UpdateBankCardInput => ({
  id,
  ...buildCreateInput(form),
});

const buildInitialForm = (): BankCardFormState => ({
  title: '',
  holder: '',
  number: '',
  expiryMmYy: '',
  cvc: '',
  note: '',
  tagsText: '',
});

export function useBankCardsViewModel({
  cards,
  selectedCardId,
  isTrashMode,
  onSelectCard,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onRestoreCard,
  onPurgeCard,
}: UseBankCardsParams): BankCardsViewModel {
  const { t } = useTranslation('BankCards');
  const [createForm, setCreateForm] = useState<BankCardFormState>(buildInitialForm);
  const [editForm, setEditForm] = useState<BankCardFormState | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const resetCreateForm = useCallback(() => {
    setCreateForm(buildInitialForm());
  }, []);

  const resetEditForm = useCallback(() => {
    setEditForm(null);
    setEditCardId(null);
    setEditError(null);
  }, []);

  const openCreateModal = useCallback(() => {
    resetCreateForm();
    setCreateError(null);
    setCreateOpen(true);
  }, [resetCreateForm]);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
    setCreateError(null);
    resetCreateForm();
  }, [resetCreateForm]);

  const openEditModal = useCallback((card: BankCardItem) => {
    setEditForm({
      title: card.title ?? '',
      holder: card.holder ?? '',
      number: card.number ?? '',
      expiryMmYy: card.expiryMmYy ?? '',
      cvc: card.cvc ?? '',
      note: card.note ?? '',
      tagsText: (card.tags ?? []).join(', '),
    });
    setEditCardId(card.id);
    setEditError(null);
    setEditOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    resetEditForm();
  }, [resetEditForm]);

  const updateCreateField = useCallback((field: keyof BankCardFormState, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateEditField = useCallback((field: keyof BankCardFormState, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const submitCreate = useCallback(async () => {
    if (isCreateSubmitting) return;
    setCreateError(null);
    const trimmedTitle = createForm.title.trim();
    if (!trimmedTitle) {
      setCreateError(t('validation.titleRequired'));
      return;
    }
    setIsCreateSubmitting(true);
    try {
      await onCreateCard(buildCreateInput(createForm));
      setCreateOpen(false);
      resetCreateForm();
    } catch {
      setCreateError(t('validation.titleRequired'));
    } finally {
      setIsCreateSubmitting(false);
    }
  }, [createForm, isCreateSubmitting, onCreateCard, resetCreateForm, t]);

  const submitEdit = useCallback(async () => {
    if (isEditSubmitting || !editForm || !editCardId) return;
    setEditError(null);
    const trimmedTitle = editForm.title.trim();
    if (!trimmedTitle) {
      setEditError(t('validation.titleRequired'));
      return;
    }
    setIsEditSubmitting(true);
    try {
      await onUpdateCard(buildUpdateInput(editForm, editCardId));
      setEditOpen(false);
      resetEditForm();
    } catch {
      setEditError(t('validation.titleRequired'));
    } finally {
      setIsEditSubmitting(false);
    }
  }, [editCardId, editForm, isEditSubmitting, onUpdateCard, resetEditForm, t]);

  const selectCard = useCallback(
    (id: string) => {
      onSelectCard(id === selectedCardId ? null : id);
    },
    [onSelectCard, selectedCardId]
  );

  const deleteCard = useCallback(
    (id: string) => {
      if (isTrashMode) return;
      onDeleteCard(id);
    },
    [isTrashMode, onDeleteCard]
  );

  const restoreCard = useCallback(
    (id: string) => {
      if (!isTrashMode) return;
      onRestoreCard(id);
    },
    [isTrashMode, onRestoreCard]
  );

  const purgeCard = useCallback(
    (id: string) => {
      if (!isTrashMode) return;
      onPurgeCard(id);
    },
    [isTrashMode, onPurgeCard]
  );

  return {
    cards,
    selectedCardId,
    isTrashMode,
    selectCard,
    deleteCard,
    restoreCard,
    purgeCard,
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
    isCreateSubmitting,
    isEditSubmitting,
    updateCreateField,
    updateEditField,
    submitCreate,
    submitEdit,
  };
}
