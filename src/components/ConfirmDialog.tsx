import React from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <div className="dialog-header">
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
        <div className="dialog-actions">
          <button className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="primary primary-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
