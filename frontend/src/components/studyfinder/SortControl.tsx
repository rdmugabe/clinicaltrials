'use client';

import type { SortOption } from '@/types';
import { STUDY_SORT_FIELDS, type SortFieldOption, type SortOrder } from '@/lib/sortStudies';

/** Reusable "Sort by" control: a field dropdown + an ascending/descending toggle. */
export default function SortControl({
  field,
  order,
  onChange,
  fields = STUDY_SORT_FIELDS,
}: {
  field: SortOption;
  order: SortOrder;
  onChange: (field: SortOption, order: SortOrder) => void;
  fields?: SortFieldOption[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400">Sort</span>
      <select
        value={field}
        onChange={(e) => onChange(e.target.value as SortOption, order)}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {fields.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(field, order === 'asc' ? 'desc' : 'asc')}
        title={order === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
        aria-label={order === 'asc' ? 'Sort ascending' : 'Sort descending'}
        className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {order === 'asc' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 8V8m0 0l-4 4m4-4l4 4" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0v8m0 0l4-4m-4 4l-4-4" />
          )}
        </svg>
      </button>
    </div>
  );
}
