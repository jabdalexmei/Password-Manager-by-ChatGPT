import { useCallback, useMemo } from 'react';
import startup from '../i18n/English/Startup.json';
import profileCreate from '../i18n/English/ProfileCreate.json';
import login from '../i18n/English/LogIn.json';
import vault from '../i18n/English/Vault.json';
import dataCards from '../i18n/English/DataCards.json';
import bankCards from '../i18n/English/BankCards.json';
import common from '../i18n/English/Common.json';
import search from '../i18n/English/Search.json';
import folders from '../i18n/English/Folders.json';
import details from '../i18n/English/Details.json';
import workspace from '../i18n/English/Workspace.json';

type Dictionaries = {
  Common: typeof common;
  Startup: typeof startup;
  ProfileCreate: typeof profileCreate;
  LogIn: typeof login;
  Vault: typeof vault;
  DataCards: typeof dataCards;
  BankCards: typeof bankCards;
  Search: typeof search;
  Folders: typeof folders;
  Details: typeof details;
  Workspace: typeof workspace;
};

const dictionaries: Dictionaries = {
  Common: common,
  Startup: startup,
  ProfileCreate: profileCreate,
  LogIn: login,
  Vault: vault,
  DataCards: dataCards,
  BankCards: bankCards,
  Search: search,
  Folders: folders,
  Details: details,
  Workspace: workspace,
};

export type Namespace = keyof Dictionaries;

export const useTranslation = (namespace?: Namespace) => {
  const dict = useMemo(() => (namespace ? dictionaries[namespace] : undefined), [namespace]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (!dict || !(key in dict)) return key;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result = (dict as any)[key] as string;
      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          const pattern = new RegExp(`{{${paramKey}}}`, 'g');
          result = result.replace(pattern, String(value));
        });
      }

      return result;
    },
    [dict]
  );

  return useMemo(() => ({ t }), [t]);
};

export const tGlobal = (
  namespace: Namespace,
  key: string,
  params?: Record<string, string | number>
): string => {
  const dict = dictionaries[namespace];
  if (!(key in dict)) return key;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = (dict as any)[key] as string;
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      const pattern = new RegExp(`{{${paramKey}}}`, 'g');
      result = result.replace(pattern, String(value));
    });
  }

  return result;
};
