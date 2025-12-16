import { useCallback, useEffect, useRef, useState } from 'react';
import { DataCard } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useToaster } from '../../../../components/Toaster';

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
  }, [card?.id, clearPendingTimeout]);

  const copyToClipboard = useCallback(
    async (value: string | null | undefined, opts: { isSecret?: boolean } = {}) => {
      if (!value || !value.trim()) return;
      clearPendingTimeout();
      try {
        await navigator.clipboard.writeText(value);
        showToast(t('toast.copySuccess'));
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
        showToast(t('toast.copyError'));
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

  return {
    showPassword,
    togglePasswordVisibility,
    copyToClipboard,
    deleteCard,
    editCard,
    toggleFavorite,
    restoreCard,
    purgeCard,
  };
}
