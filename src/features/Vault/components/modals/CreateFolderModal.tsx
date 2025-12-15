import React, { useState } from 'react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function CreateFolderModal({ isOpen, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Create Folder</h3>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              if (!name.trim()) return;
              onSubmit(name.trim());
              setName('');
              onClose();
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
