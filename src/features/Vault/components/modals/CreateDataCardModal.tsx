import React, { useMemo, useState } from 'react';
import { Folder, CreateDataCardInput } from '../../types/ui';

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

  const tagsText = useMemo(() => (form.tags || []).join(', '), [form.tags]);

  if (!isOpen) return null;

  const setField = (key: keyof CreateDataCardInput, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Create Data Card</h3>
        <label>
          Title*
          <input value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </label>
        <label>
          Folder
          <select value={form.folderId ?? ''} onChange={(e) => setField('folderId', e.target.value || null)}>
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Username
          <input value={form.username || ''} onChange={(e) => setField('username', e.target.value)} />
        </label>
        <label>
          Email
          <input value={form.email || ''} onChange={(e) => setField('email', e.target.value)} />
        </label>
        <label>
          URL
          <input value={form.url || ''} onChange={(e) => setField('url', e.target.value)} />
        </label>
        <label>
          Password
          <input value={form.password || ''} onChange={(e) => setField('password', e.target.value)} />
        </label>
        <label>
          Mobile
          <input value={form.mobilePhone || ''} onChange={(e) => setField('mobilePhone', e.target.value)} />
        </label>
        <label>
          Note
          <textarea value={form.note || ''} onChange={(e) => setField('note', e.target.value)} />
        </label>
        <label>
          Tags (comma separated)
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
            Create
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
