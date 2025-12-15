import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from '../lib/i18n';

type Toast = { id: number; message: string };

type ToasterContextValue = {
  show: (message: string) => void;
};

const ToasterContext = createContext<ToasterContextValue | undefined>(undefined);

export const ToasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t: tCommon } = useTranslation('Common');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string) => {
    setToasts((prev) => [...prev, { id: Date.now(), message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            <button onClick={() => dismiss(toast.id)} aria-label={tCommon('aria.dismissToast')}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
};

export const useToaster = () => {
  const { t: tCommon } = useTranslation('Common');
  const ctx = useContext(ToasterContext);
  if (!ctx) {
    throw new Error(tCommon('error.hookToaster'));
  }
  return ctx;
};
