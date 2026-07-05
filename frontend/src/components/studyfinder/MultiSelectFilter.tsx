'use client';

import { useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

/** A compact checkbox-popover multi-select, matching the Discover feed filters. */
export default function MultiSelectFilter({
  allLabel,
  countNoun,
  heading,
  options,
  selected,
  onChange,
  width = 'w-56',
}: {
  allLabel: string; // e.g. "All statuses"
  countNoun: string; // e.g. "statuses"
  heading: string; // popover heading, e.g. "Study status"
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? `1 ${countNoun}`
        : `${selected.length} ${countNoun}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {label}
        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute z-20 mt-1 ${width} rounded-lg border border-slate-200 bg-white p-1 shadow-lg`}>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{heading}</span>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} className="text-xs text-primary-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
            {options.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
