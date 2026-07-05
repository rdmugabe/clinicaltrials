'use client';

import { useEffect, useState } from 'react';
import FeedCard from './FeedCard';
import StudyDetailPanel from './StudyDetailPanel';
import {
  getStudiesByIds,
  bookmarkStudy,
  removeBookmark,
  hideStudy,
  unhideStudy,
  pushToPipeline,
} from '@/lib/api';
import type { StudyCard } from '@/types';

export default function TrackedStudiesPanel({
  title,
  subtitle,
  nctIds,
  onClose,
}: {
  title: string;
  subtitle?: string;
  nctIds: string[];
  onClose: () => void;
}) {
  const [studies, setStudies] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (nctIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getStudiesByIds(nctIds)
      .then((d) => setStudies(d.studies))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load studies'))
      .finally(() => setLoading(false));
  }, [nctIds]);

  const patch = (id: string, p: Partial<StudyCard>) =>
    setStudies((prev) => prev.map((s) => (s.nctId === id ? { ...s, ...p } : s)));

  const handleBookmark = async (study: StudyCard) => {
    if (study.bookmarked) {
      patch(study.nctId, { bookmarked: false });
      await removeBookmark(study.nctId);
    } else {
      patch(study.nctId, { bookmarked: true });
      await bookmarkStudy({ ...study, bookmarked: true });
    }
  };
  const handleHide = async (study: StudyCard) => {
    patch(study.nctId, { hidden: !study.hidden });
    study.hidden ? await unhideStudy(study.nctId) : await hideStudy(study.nctId);
  };
  const handlePush = async (study: StudyCard) => {
    patch(study.nctId, { inPipeline: true });
    await pushToPipeline({
      nctId: study.nctId,
      title: study.title,
      sponsor: study.sponsor,
      indications: study.conditions,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              {subtitle ? `${subtitle} · ` : ''}
              {nctIds.length} {nctIds.length === 1 ? 'study' : 'studies'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
              <p className="mt-3 text-sm text-slate-500">Loading studies…</p>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : studies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
              No studies to show yet.
            </div>
          ) : (
            <div className="space-y-3">
              {studies.map((s) => (
                <FeedCard
                  key={s.nctId}
                  study={s}
                  onSelect={setSelected}
                  onBookmark={handleBookmark}
                  onHide={handleHide}
                  onPush={handlePush}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && <StudyDetailPanel nctId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
