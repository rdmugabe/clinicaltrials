'use client';

import { useEffect, useState } from 'react';
import { getMembers, type AuthUser } from '@/lib/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** 'assign' → blank option is "Unassigned"; 'filter' → "All assignees". */
  mode?: 'assign' | 'filter';
  /** Extra names to include (e.g. legacy assignees already on existing records). */
  extraOptions?: string[];
}

// A shared assignee picker sourced from the team roster, so assignments line up
// with real members instead of free-typed strings. Names (not ids) are stored to
// stay compatible with existing records and the Reports "by assignee" grouping.
export default function AssigneeSelect({ value, onChange, className, mode = 'assign', extraOptions = [] }: Props) {
  const [members, setMembers] = useState<AuthUser[]>([]);

  useEffect(() => {
    getMembers()
      .then(setMembers)
      .catch(() => {});
  }, []);

  const names = members.map((m) => m.name || m.email);
  // Merge roster + any extra/legacy values + the current value, de-duped, so a
  // value assigned before someone left the team still renders.
  const options = Array.from(
    new Set([...names, ...extraOptions.filter(Boolean), ...(value ? [value] : [])])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{mode === 'filter' ? 'All assignees' : 'Unassigned'}</option>
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
