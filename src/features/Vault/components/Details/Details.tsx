import React from 'react';
import { DataCard, Folder } from '../../types/ui';

export type DetailsProps = {
  card: DataCard | null;
  folders: Folder[];
  onEdit: (card: DataCard) => void;
  onDelete: (id: string) => void;
};

export function Details({ card, folders, onEdit, onDelete }: DetailsProps) {
  if (!card) {
    return <div className="vault-empty">Select a card to see details</div>;
  }

  const folderName = card.folderId ? folders.find((f) => f.id === card.folderId)?.name : 'No folder';

  return (
    <div className="vault-details-card">
      <div className="vault-panel-header">
        <span>Details</span>
        <div className="vault-detail-actions">
          <button className="btn btn-secondary" type="button" onClick={() => onEdit(card)}>
            Edit
          </button>
          <button className="btn btn-danger" type="button" onClick={() => onDelete(card.id)}>
            Delete
          </button>
        </div>
      </div>
      <dl className="vault-detail-grid">
        <dt>Title</dt>
        <dd>{card.title}</dd>
        <dt>Folder</dt>
        <dd>{folderName}</dd>
        <dt>Username</dt>
        <dd>{card.username || '—'}</dd>
        <dt>Email</dt>
        <dd>{card.email || '—'}</dd>
        <dt>URL</dt>
        <dd>{card.url || '—'}</dd>
        <dt>Mobile</dt>
        <dd>{card.mobilePhone || '—'}</dd>
        <dt>Password</dt>
        <dd>{card.password || '—'}</dd>
        <dt>Note</dt>
        <dd>{card.note || '—'}</dd>
        <dt>Tags</dt>
        <dd>{card.tags && card.tags.length > 0 ? card.tags.join(', ') : '—'}</dd>
      </dl>
    </div>
  );
}
