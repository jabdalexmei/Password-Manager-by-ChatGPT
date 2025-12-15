import {
  BackendCreateDataCardInput,
  BackendDataCard,
  BackendFolder,
  BackendUpdateDataCardInput,
} from './backend';
import { DataCard, Folder, CreateDataCardInput, UpdateDataCardInput } from './ui';

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
