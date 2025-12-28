import { useCallback, useState } from 'react';
import { useTranslation } from '../../../../shared/lib/i18n';
import { BankCardItem, BankCardSummary, CreateBankCardInput, UpdateBankCardInput } from '../../types/ui';

export type BankCardFieldErrorKey = 'title' | 'expiryMmYy' | 'cvc';
export type BankCardFieldErrors = Partial<Record<BankCardFieldErrorKey, string>>;

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
  createErrors: BankCardFieldErrors;
  editErrors: BankCardFieldErrors;
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

const EXPIRY_RE = /^(0[1-9]|1[0-2])\/\d{2}$/;
const CVC_RE = /^\d{3,4}$/;

const formatExpiryMmYy = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const formatCvc = (raw: string) => raw.replace(/\D/g, '').slice(0, 4);

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
  const [createErrors, setCreateErrors] = useState<BankCardFieldErrors>({});
  const [editErrors, setEditErrors] = useState<BankCardFieldErrors>({});
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const resetCreateForm = useCallback(() => {
    setCreateForm(buildInitialForm());
  }, []);

  const resetEditForm = useCallback(() => {
    setEditForm(null);
    setEditCardId(null);
    setEditErrors({});
  }, []);

  const openCreateModal = useCallback(() => {
    resetCreateForm();
    setCreateErrors({});
    setCreateOpen(true);
  }, [resetCreateForm]);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
    setCreateErrors({});
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
    setEditErrors({});
    setEditOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    resetEditForm();
  }, [resetEditForm]);

  const updateCreateField = useCallback((field: keyof BankCardFormState, value: string) => {
    const nextValue =
      field === 'expiryMmYy' ? formatExpiryMmYy(value) : field === 'cvc' ? formatCvc(value) : value;
    setCreateForm((prev) => ({ ...prev, [field]: nextValue }));
    if (field === 'title' || field === 'expiryMmYy' || field === 'cvc') {
      setCreateErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, []);

  const updateEditField = useCallback((field: keyof BankCardFormState, value: string) => {
    const nextValue =
      field === 'expiryMmYy' ? formatExpiryMmYy(value) : field === 'cvc' ? formatCvc(value) : value;
    setEditForm((prev) => (prev ? { ...prev, [field]: nextValue } : prev));
    if (field === 'title' || field === 'expiryMmYy' || field === 'cvc') {
      setEditErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, []);

  const submitCreate = useCallback(async () => {
    if (isCreateSubmitting) return;
    setCreateErrors({});
    const trimmedTitle = createForm.title.trim();
    const nextErrors: BankCardFieldErrors = {};
    if (!trimmedTitle) nextErrors.title = t('validation.titleRequired');

    const expiry = createForm.expiryMmYy.trim();
    if (expiry.length > 0 && !EXPIRY_RE.test(expiry)) {
      nextErrors.expiryMmYy = t('validation.expiryInvalid');
    }

    const cvc = createForm.cvc.trim();
    if (cvc.length > 0 && !CVC_RE.test(cvc)) {
      nextErrors.cvc = t('validation.cvcInvalid');
    }

    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      return;
    }
    setIsCreateSubmitting(true);
    try {
      await onCreateCard(buildCreateInput(createForm));
      setCreateOpen(false);
      resetCreateForm();
    } catch {
      setCreateErrors({ title: t('validation.titleRequired') });
    } finally {
      setIsCreateSubmitting(false);
    }
  }, [createForm, isCreateSubmitting, onCreateCard, resetCreateForm, t]);

  const submitEdit = useCallback(async () => {
    if (isEditSubmitting || !editForm || !editCardId) return;
    setEditErrors({});
    const trimmedTitle = editForm.title.trim();
    const nextErrors: BankCardFieldErrors = {};
    if (!trimmedTitle) nextErrors.title = t('validation.titleRequired');

    const expiry = editForm.expiryMmYy.trim();
    if (expiry.length > 0 && !EXPIRY_RE.test(expiry)) {
      nextErrors.expiryMmYy = t('validation.expiryInvalid');
    }

    const cvc = editForm.cvc.trim();
    if (cvc.length > 0 && !CVC_RE.test(cvc)) {
      nextErrors.cvc = t('validation.cvcInvalid');
    }

    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }
    setIsEditSubmitting(true);
    try {
      await onUpdateCard(buildUpdateInput(editForm, editCardId));
      setEditOpen(false);
      resetEditForm();
    } catch {
      setEditErrors({ title: t('validation.titleRequired') });
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
    createErrors,
    editErrors,
    isCreateSubmitting,
    isEditSubmitting,
    updateCreateField,
    updateEditField,
    submitCreate,
    submitEdit,
  };
}
