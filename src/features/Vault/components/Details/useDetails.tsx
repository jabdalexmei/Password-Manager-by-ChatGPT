import { useCallback, useEffect, useRef, useState } from 'react';
import { Attachment, DataCard } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';
import { useToaster } from '../../../../components/Toaster';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  addAttachmentFromPath,
  getAttachmentPreview,
  listAttachments,
  purgeAttachment,
  saveAttachmentToPath,
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
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onPreviewAttachment: (attachmentId: string) => Promise<void>;
  onDownloadAttachment: (attachmentId: string, defaultName: string) => Promise<void>;
  previewOpen: boolean;
  closePreview: () => void;
  previewPayload: AttachmentPreviewState;
  isPreviewLoading: boolean;
};

type AttachmentPreviewState = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
} | null;

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<AttachmentPreviewState>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastCopiedValueRef.current = null;
  }, []);

  useEffect(() => clearPendingTimeout, [clearPendingTimeout]);
  const refreshAttachments = useCallback(async () => {
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
  }, [card?.id, showToast, t]);

  useEffect(() => {
    setShowPassword(false);
    clearPendingTimeout();
    refreshAttachments();
    setPreviewOpen(false);
    setPreviewPayload(null);
  }, [card?.id, clearPendingTimeout, refreshAttachments]);

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
      await refreshAttachments();
      showToast(t('toast.attachmentAddSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('toast.attachmentAddError'), 'error');
    }
  }, [card, isTrashMode, refreshAttachments, showToast, t]);

  const onDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (!card) return;
      try {
        await purgeAttachment(attachmentId);
        await refreshAttachments();
      } catch (err) {
        console.error(err);
        showToast(t('toast.attachmentRemoveError'), 'error');
      }
    },
    [card, refreshAttachments, showToast, t]
  );

  const onPreviewAttachment = useCallback(
    async (attachmentId: string) => {
      if (!card) return;
      setIsPreviewLoading(true);
      setPreviewOpen(true);
      setPreviewPayload(null);
      try {
        const payload = await getAttachmentPreview(attachmentId);
        setPreviewPayload({
          attachmentId: payload.attachment_id,
          fileName: payload.file_name,
          mimeType: payload.mime_type,
          base64Data: payload.base64_data,
        });
      } catch (err: any) {
        console.error(err);
        const errorMessage = err?.code === 'ATTACHMENT_TOO_LARGE_FOR_PREVIEW'
          ? t('attachments.previewTooLarge')
          : t('attachments.previewError');
        showToast(errorMessage, 'error');
        setPreviewOpen(false);
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [card, showToast, t]
  );

  const onDownloadAttachment = useCallback(
    async (attachmentId: string, defaultName: string) => {
      if (!card) return;
      try {
        const selection = await save({ defaultPath: defaultName });
        const targetPath = Array.isArray(selection) ? selection[0] : selection;
        if (!targetPath || typeof targetPath !== 'string') return;
        await saveAttachmentToPath(attachmentId, targetPath);
        showToast(t('attachments.downloadSuccess'), 'success');
      } catch (err) {
        console.error(err);
        showToast(t('attachments.downloadError'), 'error');
      }
    },
    [card, showToast, t]
  );

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewPayload(null);
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
    attachments,
    onAddAttachment,
    onDeleteAttachment,
    onPreviewAttachment,
    onDownloadAttachment,
    previewOpen,
    closePreview,
    previewPayload,
    isPreviewLoading,
  };
}
