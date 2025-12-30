export type VaultSearchFilterKey =
  | 'has2fa'
  | 'hasSeedPhrase'
  | 'hasPhone'
  | 'hasNotes'
  | 'hasAttachments';

export type VaultSearchFilters = Record<VaultSearchFilterKey, boolean>;

export const defaultVaultSearchFilters: VaultSearchFilters = {
  has2fa: false,
  hasSeedPhrase: false,
  hasPhone: false,
  hasNotes: false,
  hasAttachments: false,
};
