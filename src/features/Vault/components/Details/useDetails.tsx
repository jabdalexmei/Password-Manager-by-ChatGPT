import { useCallback, useEffect, useRef, useState } from 'react';
import { Attachment, DataCard } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useToaster } from '../../../../components/Toaster';
import { open } from '@tauri-apps/plugin-dialog';
import {
  addAttachmentFromPath,
  listAttachments,
  openAttachment,
  removeAttachment,
} from '../../api/vaultApi';
import { mapAttachmentFromBackend } from '../../types/mappers';

const DEFAULT_CLIPBOARD_CLEAR_TIMEOUT_SECONDS = 30;

type UseDetailsParams = {
  card: DataCard | null;
  onEdit: (card: DataCard) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  isTrashMode: boolean;
  clipboardClearTimeoutSeconds?: number;
};

type UseDetailsResult = {
  showPassword: boolean;
  togglePasswordVisibility: () => void;
  copyToClipboard: (value: string | null | undefined, opts?: { isSecret?: boolean }) => Promise<void>;
  deleteCard: () => void;
  editCard: () => void;
  toggleFavorite: () => void;
  restoreCard: () => void;
  purgeCard: () => void;
  attachments: Attachment[];
  onAddAttachment: () => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
  onOpenAttachment: (attachmentId: string) => Promise<void>;
};

export function useDetails({
  card,
  onEdit,
  onDelete,
  onToggleFavorite,
  onRestore,
  onPurge,
  isTrashMode,
  clipboardClearTimeoutSeconds,
}: UseDetailsParams): UseDetailsResult {
  const [showPassword, setShowPassword] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopiedValueRef = useRef<string | null>(null);
  const { show: showToast } = useToaster();
  const { t } = useTranslation('Details');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastCopiedValueRef.current = null;
  }, []);

  useEffect(() => clearPendingTimeout, [clearPendingTimeout]);
  useEffect(() => {
    setShowPassword(false);
    clearPendingTimeout();
    const refresh = async () => {
      if (!card?.id) {
        setAttachments([]);
        return;
      }
      try {
        const items = await listAttachments(card.id);
        setAttachments(items.map(mapAttachmentFromBackend));
      } catch (err) {
        console.error(err);
        setAttachments([]);
        showToast(t('toast.attachmentLoadError'), 'error');
      }
    };
    refresh();
  }, [card?.id, clearPendingTimeout, showToast, t]);

  const copyToClipboard = useCallback(
    async (value: string | null | undefined, opts: { isSecret?: boolean } = {}) => {
      if (!value || !value.trim()) return;
      clearPendingTimeout();
      try {
        await navigator.clipboard.writeText(value);
        showToast(t('toast.copySuccess'), 'success');
        if (opts.isSecret) {
          lastCopiedValueRef.current = value;
          const timeoutMs = (clipboardClearTimeoutSeconds ?? DEFAULT_CLIPBOARD_CLEAR_TIMEOUT_SECONDS) * 1000;
          timeoutRef.current = window.setTimeout(async () => {
            try {
              const currentClipboard = await navigator.clipboard.readText();
              if (currentClipboard === lastCopiedValueRef.current) {
                await navigator.clipboard.writeText('');
              }
            } catch (err) {
              console.error(err);
            }
            timeoutRef.current = null;
            lastCopiedValueRef.current = null;
          }, timeoutMs);
        }
      } catch (err) {
        console.error(err);
        showToast(t('toast.copyError'), 'error');
        lastCopiedValueRef.current = null;
      }
    },
    [clearPendingTimeout, clipboardClearTimeoutSeconds, showToast, t]
  );

  const deleteCard = useCallback(() => {
    if (!card || isTrashMode) return;
    onDelete(card.id);
  }, [card, isTrashMode, onDelete]);

  const editCard = useCallback(() => {
    if (!card || isTrashMode) return;
    onEdit(card);
  }, [card, isTrashMode, onEdit]);

  const toggleFavorite = useCallback(() => {
    if (!card || isTrashMode) return;
    onToggleFavorite(card.id);
  }, [card, isTrashMode, onToggleFavorite]);

  const restoreCard = useCallback(() => {
    if (card) onRestore(card.id);
  }, [card, onRestore]);

  const purgeCard = useCallback(() => {
    if (card) onPurge(card.id);
  }, [card, onPurge]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const onAddAttachment = useCallback(async () => {
    if (!card || isTrashMode) return;
    try {
      const selection = await open({ multiple: false });
      const path = Array.isArray(selection) ? selection[0] : selection;
      if (!path || typeof path !== 'string') return;
      await addAttachmentFromPath(card.id, path);
      const items = await listAttachments(card.id);
      setAttachments(items.map(mapAttachmentFromBackend));
      showToast(t('toast.attachmentAddSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('toast.attachmentAddError'), 'error');
    }
  }, [card, isTrashMode, showToast, t]);

  const onRemoveAttachment = useCallback(
    async (attachmentId: string) => {
      if (!card) return;
      try {
        await removeAttachment(attachmentId);
        const items = await listAttachments(card.id);
        setAttachments(items.map(mapAttachmentFromBackend));
      } catch (err) {
        console.error(err);
        showToast(t('toast.attachmentRemoveError'), 'error');
      }
    },
    [card, showToast, t]
  );

  const onOpenAttachment = useCallback(
    async (attachmentId: string) => {
      if (!card) return;
      try {
        await openAttachment(attachmentId);
      } catch (err) {
        console.error(err);
        showToast(t('toast.attachmentOpenError'), 'error');
      }
    },
    [card, showToast, t]
  );

  return {
    showPassword,
    togglePasswordVisibility,
    copyToClipboard,
    deleteCard,
    editCard,
    toggleFavorite,
    restoreCard,
    purgeCard,
    attachments,
    onAddAttachment,
    onRemoveAttachment,
    onOpenAttachment,
  };
}
