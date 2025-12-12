export interface Folder {
  id: string;
  name: string;
}

export interface DataCard {
  id: string;

  title: string;
  username?: string;
  email?: string;
  mobilePhone?: string;
  password: string;
  url?: string;
  notes?: string;

  folderId: string;
  favorite: boolean;
  archived: boolean;
  deletedAt?: string;

  createdAt: string;
  updatedAt: string;
}
