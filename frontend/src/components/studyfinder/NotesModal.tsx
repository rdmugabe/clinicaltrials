'use client';

import NotesPanel from './NotesPanel';
import type { NoteEntityType } from '@/types';

/** Modal wrapper around NotesPanel for list surfaces (e.g. contact rows). */
export default function NotesModal({
  title,
  subtitle,
  entityType,
  entityId,
  onClose,
  onCountChange,
}: {
  title: string;
  subtitle?: string;
  entityType: NoteEntityType;
  entityId: string;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <NotesPanel entityType={entityType} entityId={entityId} onCountChange={onCountChange} />
        </div>
      </div>
    </div>
  );
}
