import React from 'react';

type Props = {
  isOn: boolean;
  onToggle: (on: boolean) => void;
};

export function TrashToggle({ isOn, onToggle }: Props) {
  return (
    <label className="trash-toggle">
      <input type="checkbox" checked={isOn} onChange={(e) => onToggle(e.target.checked)} />
      <span>Trash mode</span>
    </label>
  );
}
