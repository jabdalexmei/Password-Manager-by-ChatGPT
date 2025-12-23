import {
  BackendCreateDataCardInput,
  BackendDataCard,
  BackendDataCardSummary,
  BackendFolder,
  BackendAttachmentMeta,
  BackendUpdateDataCardInput,
  BackendPasswordHistoryRow,
} from './backend';
import {
  DataCard,
  Folder,
  CreateDataCardInput,
  UpdateDataCardInput,
  DataCardSummary,
  Attachment,
  PasswordHistoryEntry,
} from './ui';

export function mapFolderFromBackend(folder: BackendFolder): Folder {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    isSystem: folder.is_system,
    createdAt: folder.created_at,
    updatedAt: folder.updated_at,
    deletedAt: folder.deleted_at,
  };
}

export function mapCardFromBackend(card: BackendDataCard): DataCard {
  return {
    id: card.id,
    folderId: card.folder_id,
    title: card.title,
    url: card.url,
    email: card.email,
    username: card.username,
    mobilePhone: card.mobile_phone,
    note: card.note,
    isFavorite: card.is_favorite,
    tags: card.tags ?? [],
    createdAt: card.created_at,
    updatedAt: card.updated_at,
    deletedAt: card.deleted_at,
    password: card.password,
    bankCard: card.bank_card
      ? {
          holder: card.bank_card.holder,
          number: card.bank_card.number,
          expiryMmYy: card.bank_card.expiry_mm_yy,
          cvc: card.bank_card.cvc,
          note: card.bank_card.note,
        }
      : null,
    customFields: (card.custom_fields || []).map((field) => ({
      key: field.key,
      value: field.value,
      type: field.type,
    })),
  };
}

const metaFromCard = (card: { username: string | null; email: string | null; url: string | null }, fallback: string) =>
  card.username || card.email || card.url || fallback;

export function mapCardSummaryFromBackend(
  card: BackendDataCardSummary,
  formatter: Intl.DateTimeFormat
): DataCardSummary {
  const updatedAtLabel = formatter.format(new Date(card.updated_at));
  const createdAtLabel = formatter.format(new Date(card.created_at));

  return {
    id: card.id,
    folderId: card.folder_id,
    title: card.title,
    url: card.url,
    email: card.email,
    username: card.username,
    mobilePhone: null,
    note: null,
    tags: card.tags ?? [],
    createdAt: card.created_at,
    updatedAt: card.updated_at,
    deletedAt: card.deleted_at,
    password: null,
    bankCard: null,
    customFields: [],
    isFavorite: card.is_favorite,
    updatedAtLabel,
    createdAtLabel,
    metaLine: metaFromCard(card, ''),
  };
}

export function mapCardToSummary(card: DataCard, formatter: Intl.DateTimeFormat): DataCardSummary {
  const updatedAtLabel = formatter.format(new Date(card.updatedAt));
  const createdAtLabel = formatter.format(new Date(card.createdAt));

  return {
    ...card,
    updatedAtLabel,
    createdAtLabel,
    metaLine: metaFromCard(card, ''),
  };
}

export function mapAttachmentFromBackend(attachment: BackendAttachmentMeta): Attachment {
  return {
    id: attachment.id,
    datacardId: attachment.datacard_id,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    byteSize: attachment.byte_size,
    createdAt: attachment.created_at,
    updatedAt: attachment.updated_at,
    deletedAt: attachment.deleted_at,
  };
}

export function mapPasswordHistoryFromBackend(entry: BackendPasswordHistoryRow): PasswordHistoryEntry {
  return {
    id: entry.id,
    datacardId: entry.datacard_id,
    passwordValue: entry.password_value,
    createdAt: entry.created_at,
  };
}

export function mapCreateCardToBackend(input: CreateDataCardInput): BackendCreateDataCardInput {
  return {
    folder_id: input.folderId,
    title: input.title,
    url: input.url ?? null,
    email: input.email ?? null,
    username: input.username ?? null,
    mobile_phone: input.mobilePhone ?? null,
    note: input.note ?? null,
    tags: input.tags ?? [],
    password: input.password ?? null,
    bank_card: null,
    custom_fields: [],
  };
}

export function mapUpdateCardToBackend(input: UpdateDataCardInput): BackendUpdateDataCardInput {
  return {
    id: input.id,
    ...mapCreateCardToBackend(input),
  };
}
