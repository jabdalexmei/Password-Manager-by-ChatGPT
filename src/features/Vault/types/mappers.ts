import {
  BackendBankCardItem,
  BackendBankCardSummary,
  BackendCreateBankCardInput,
  BackendCreateDataCardInput,
  BackendDataCard,
  BackendDataCardSummary,
  BackendFolder,
  BackendAttachmentMeta,
  BackendUpdateBankCardInput,
  BackendUpdateDataCardInput,
  BackendPasswordHistoryRow,
} from './backend';
import {
  BankCardItem,
  BankCardSummary,
  CreateBankCardInput,
  DataCard,
  Folder,
  UpdateBankCardInput,
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
    totpUri: card.totp_uri,
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
    totpUri: null,
    customFields: [],
    isFavorite: card.is_favorite,
    hasTotp: card.has_totp,
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
    hasTotp: (card.totpUri ?? null) !== null,
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
    totp_uri: input.totpUri ?? null,
    custom_fields: (input.customFields ?? []).map((field) => ({
      key: field.key,
      value: field.value,
      type: field.type,
    })),
  };
}

export function mapUpdateCardToBackend(input: UpdateDataCardInput): BackendUpdateDataCardInput {
  return {
    id: input.id,
    ...mapCreateCardToBackend(input),
  };
}

const maskCardNumber = (value?: string | null) => {
  const trimmed = value?.replace(/\s+/g, '') ?? '';
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
};

export function mapBankCardFromBackend(card: BackendBankCardItem): BankCardItem {
  return {
    id: card.id,
    title: card.title,
    holder: card.holder,
    number: card.number,
    expiryMmYy: card.expiry_mm_yy,
    cvc: card.cvc,
    note: card.note,
    tags: card.tags ?? [],
    isFavorite: card.is_favorite,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
    deletedAt: card.deleted_at,
  };
}

export function mapBankCardSummaryFromBackend(
  card: BackendBankCardSummary,
  formatter: Intl.DateTimeFormat
): BankCardSummary {
  const updatedAtLabel = formatter.format(new Date(card.updated_at));
  const createdAtLabel = formatter.format(new Date(card.created_at));
  const metaLine = card.holder || maskCardNumber(card.number) || '';

  return {
    id: card.id,
    title: card.title,
    holder: card.holder,
    number: card.number,
    expiryMmYy: null,
    cvc: null,
    note: null,
    tags: card.tags ?? [],
    isFavorite: card.is_favorite,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
    deletedAt: card.deleted_at,
    updatedAtLabel,
    createdAtLabel,
    metaLine,
  };
}

export function mapBankCardToSummary(card: BankCardItem, formatter: Intl.DateTimeFormat): BankCardSummary {
  const updatedAtLabel = formatter.format(new Date(card.updatedAt));
  const createdAtLabel = formatter.format(new Date(card.createdAt));
  const metaLine = card.holder || maskCardNumber(card.number) || '';

  return {
    ...card,
    updatedAtLabel,
    createdAtLabel,
    metaLine,
  };
}

export function mapCreateBankCardToBackend(input: CreateBankCardInput): BackendCreateBankCardInput {
  return {
    title: input.title,
    holder: input.holder ?? null,
    number: input.number ?? null,
    expiry_mm_yy: input.expiryMmYy ?? null,
    cvc: input.cvc ?? null,
    note: input.note ?? null,
    tags: input.tags ?? [],
  };
}

export function mapUpdateBankCardToBackend(input: UpdateBankCardInput): BackendUpdateBankCardInput {
  return {
    id: input.id,
    ...mapCreateBankCardToBackend(input),
  };
}
