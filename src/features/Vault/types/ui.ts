export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CustomFieldType = "text" | "secret" | "url" | "number" | "date";

export type CustomField = {
  key: string;
  value: string;
  type: CustomFieldType;
};

export type DataCard = {
  id: string;
  folderId: string | null;
  title: string;
  url: string | null;
  email: string | null;
  username: string | null;
  mobilePhone: string | null;
  note: string | null;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  password: string | null;
  customFields: CustomField[];
};

export type PasswordHistoryEntry = {
  id: string;
  datacardId: string;
  passwordValue: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  datacardId: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DataCardSummary = DataCard & {
  updatedAtLabel: string;
  createdAtLabel: string;
  metaLine: string;
};

export type CreateDataCardInput = {
  folderId: string | null;
  title: string;
  url?: string | null;
  email?: string | null;
  username?: string | null;
  mobilePhone?: string | null;
  note?: string | null;
  tags?: string[];
  password?: string | null;
  customFields?: CustomField[];
};

export type UpdateDataCardInput = CreateDataCardInput & {
  id: string;
};

export type BankCardItem = {
  id: string;
  title: string;
  holder: string | null;
  number: string | null;
  expiryMmYy: string | null;
  cvc: string | null;
  note: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type BankCardSummary = BankCardItem & {
  updatedAtLabel: string;
  createdAtLabel: string;
  metaLine: string;
};

export type CreateBankCardInput = {
  title: string;
  holder?: string | null;
  number?: string | null;
  expiryMmYy?: string | null;
  cvc?: string | null;
  note?: string | null;
  tags?: string[];
};

export type UpdateBankCardInput = CreateBankCardInput & {
  id: string;
};
