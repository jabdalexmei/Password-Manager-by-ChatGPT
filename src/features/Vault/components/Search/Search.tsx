import React from 'react';

type Props = {
  query: string;
  onChange: (value: string) => void;
};

export function Search({ query, onChange }: Props) {
  return (
    <input
      type="search"
      className="vault-search"
      placeholder="Search vault"
      value={query}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
