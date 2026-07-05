'use client';

import type { StudyCard } from '@/types';

interface FeedCardProps {
  study: StudyCard;
  onSelect: (nctId: string) => void;
  onBookmark: (study: StudyCard) => void;
  onHide: (study: StudyCard) => void;
  onPush: (study: StudyCard) => void;
}

const FEED_STATUS_STYLES: Record<string, string> = {
  Upcoming: 'bg-amber-100 text-amber-700',
  Active: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-slate-100 text-slate-500',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function IconButton({
  label,
  active,
  onClick,
  children,
  activeClass = 'text-primary-600',
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-lg p-1.5 transition-colors hover:bg-slate-100 ${
        active ? activeClass : 'text-slate-400'
      }`}
    >
      {children}
    </button>
  );
}

export default function FeedCard({ study, onSelect, onBookmark, onHide, onPush }: FeedCardProps) {
  return (
    <div
      onClick={() => onSelect(study.nctId)}
      className={`group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        study.hidden ? 'opacity-60' : ''
      }`}
    >
      {/* Top row: date added + source + status */}
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Added {formatDate(study.dateAdded)}</span>
        <span className="text-slate-300">·</span>
        <span className="truncate text-slate-500">{study.source}</span>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            FEED_STATUS_STYLES[study.feedStatus] || 'bg-slate-100 text-slate-500'
          }`}
        >
          {study.feedStatus}
        </span>
      </div>

      {/* Phase + NCT */}
      <div className="mb-1 flex items-center gap-2 text-xs font-medium">
        {study.phase !== 'N/A' && (
          <span className="rounded bg-primary-50 px-2 py-0.5 text-primary-700">{study.phase}</span>
        )}
        <span className="font-mono text-slate-400">{study.nctId}</span>
      </div>

      {/* Title */}
      <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
        {study.title}
      </h3>

      {/* Conditions */}
      {study.conditions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {study.conditions.slice(0, 3).map((c) => (
            <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {c}
            </span>
          ))}
          {study.conditions.length > 3 && (
            <span className="px-1 py-0.5 text-[11px] text-slate-400">
              +{study.conditions.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Meta grid */}
      <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <span className="text-slate-400">Sponsor: </span>
          <span className="text-slate-700">{study.sponsor || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400">Enrollment: </span>
          <span className="text-slate-700">
            {study.enrollment != null ? study.enrollment.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center gap-1">
          <IconButton label={study.bookmarked ? 'Remove bookmark' : 'Bookmark'} active={study.bookmarked} activeClass="text-amber-500" onClick={() => onBookmark(study)}>
            <svg className="h-4 w-4" fill={study.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </IconButton>
          <IconButton label={study.hidden ? 'Unhide' : 'Hide'} active={study.hidden} onClick={() => onHide(study)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L3 3m6.88 6.88L21 21" />
            </svg>
          </IconButton>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPush(study);
          }}
          disabled={study.inPipeline}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
            study.inPipeline
              ? 'cursor-default bg-emerald-50 text-emerald-600'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {study.inPipeline ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              In TrialTrack
            </>
          ) : (
            '+ TrialTrack'
          )}
        </button>
      </div>
    </div>
  );
}
