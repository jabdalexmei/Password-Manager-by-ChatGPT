import { useMemo } from 'react';
import startup from '../i18n/English/Startup.json';
import profileCreate from '../i18n/English/ProfileCreate.json';
import login from '../i18n/English/LogIn.json';
import vault from '../i18n/English/Vault.json';

type Dictionaries = {
  Startup: typeof startup;
  ProfileCreate: typeof profileCreate;
  LogIn: typeof login;
  Vault: typeof vault;
};

const dictionaries: Dictionaries = {
  Startup: startup,
  ProfileCreate: profileCreate,
  LogIn: login,
  Vault: vault,
};

export type Namespace = keyof Dictionaries;

export const useTranslation = (namespace?: Namespace) => {
  const dict = useMemo(() => (namespace ? dictionaries[namespace] : undefined), [namespace]);
  const t = (key: string): string => {
    if (dict && key in dict) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (dict as any)[key] as string;
    }
    return key;
  };

  return { t };
};

export const tGlobal = (namespace: Namespace, key: string): string => {
  const dict = dictionaries[namespace];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (dict as any)[key] ?? key;
};
