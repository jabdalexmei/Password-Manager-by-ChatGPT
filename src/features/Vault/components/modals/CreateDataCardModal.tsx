import React, { useMemo, useState } from 'react';
import { Folder, CreateDataCardInput } from '../../types/ui';
import { useTranslation } from '../../../../lib/i18n';

type Props = {
  isOpen: boolean;
  folders: Folder[];
  defaultFolderId: string | null;
  onClose: () => void;
  onSubmit: (input: CreateDataCardInput) => void;
};

export function CreateDataCardModal({ isOpen, folders, defaultFolderId, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CreateDataCardInput>({
    title: '',
    folderId: defaultFolderId,
    username: '',
    email: '',
    url: '',
    password: '',
    note: '',
    tags: [],
    mobilePhone: '',
  });
  const { t } = useTranslation('Vault');

  const tagsText = useMemo(() => (form.tags || []).join(', '), [form.tags]);

  if (!isOpen) return null;

  const setField = (key: keyof CreateDataCardInput, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{t('createDataCardTitle')}</h3>
        <label>
          {t('titleLabel')}*
          <input value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </label>
        <label>
          {t('folderLabel')}
          <select value={form.folderId ?? ''} onChange={(e) => setField('folderId', e.target.value || null)}>
            <option value="">{t('noFolderOption')}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('username')}
          <input value={form.username || ''} onChange={(e) => setField('username', e.target.value)} />
        </label>
        <label>
          {t('email')}
          <input value={form.email || ''} onChange={(e) => setField('email', e.target.value)} />
        </label>
        <label>
          {t('url')}
          <input value={form.url || ''} onChange={(e) => setField('url', e.target.value)} />
        </label>
        <label>
          {t('password')}
          <input value={form.password || ''} onChange={(e) => setField('password', e.target.value)} />
        </label>
        <label>
          {t('mobile')}
          <input value={form.mobilePhone || ''} onChange={(e) => setField('mobilePhone', e.target.value)} />
        </label>
        <label>
          {t('note')}
          <textarea value={form.note || ''} onChange={(e) => setField('note', e.target.value)} />
        </label>
        <label>
          {t('tagsPlaceholder')}
          <input
            value={tagsText}
            onChange={(e) => setField('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          />
        </label>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              if (!form.title.trim()) return;
              onSubmit({ ...form, title: form.title.trim() });
              onClose();
              setForm({ ...form, title: '', tags: [] });
            }}
          >
            {t('create')}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
