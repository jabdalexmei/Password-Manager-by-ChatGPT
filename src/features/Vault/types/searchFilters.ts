export type VaultSearchFilters = {
  favorites: boolean;
  has2fa: boolean;
  hasAttachments: boolean;
  hasSeedPhrase: boolean;
  hasPhone: boolean;
  hasNotes: boolean;
};

export const defaultVaultSearchFilters: VaultSearchFilters = {
  favorites: false,
  has2fa: false,
  hasAttachments: false,
  hasSeedPhrase: false,
  hasPhone: false,
  hasNotes: false,
};

export type VaultSearchFilterKey = keyof VaultSearchFilters;
