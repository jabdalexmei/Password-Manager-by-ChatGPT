import React, { useEffect, useMemo, useState } from 'react';
import { DataCard, Folder, UpdateDataCardInput } from '../../types/ui';

type Props = {
  isOpen: boolean;
  card: DataCard | null;
  folders: Folder[];
  onClose: () => void;
  onSubmit: (input: UpdateDataCardInput) => void;
};

export function EditDataCardModal({ isOpen, card, folders, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<UpdateDataCardInput | null>(
    card
      ? {
          id: card.id,
          title: card.title,
          folderId: card.folderId,
          username: card.username ?? '',
          email: card.email ?? '',
          url: card.url ?? '',
          password: card.password ?? '',
          note: card.note ?? '',
          tags: card.tags ?? [],
          mobilePhone: card.mobilePhone ?? '',
        }
      : null
  );

  useEffect(() => {
    if (card) {
      setForm({
        id: card.id,
        title: card.title,
        folderId: card.folderId,
        username: card.username ?? '',
        email: card.email ?? '',
        url: card.url ?? '',
        password: card.password ?? '',
        note: card.note ?? '',
        tags: card.tags ?? [],
        mobilePhone: card.mobilePhone ?? '',
      });
    } else {
      setForm(null);
    }
  }, [card]);

  const tagsText = useMemo(() => (form?.tags || []).join(', '), [form]);

  if (!isOpen || !form) return null;

  const setField = (key: keyof UpdateDataCardInput, value: any) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Edit Data Card</h3>
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
            }}
          >
            Save
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
