'use client';

import { useEffect, useState } from 'react';
import { getEnrollments, stopEnrollment } from '@/lib/api';
import type { Sequence, SequenceEnrollment } from '@/types';

function formatWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  stopped: 'bg-slate-200 text-slate-600',
};

/** Per-recipient tracking for a sequence: step progress, status, next send, stop. */
export default function RecipientsModal({ sequence, onClose }: { sequence: Sequence; onClose: () => void }) {
  const [rows, setRows] = useState<SequenceEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState<string | null>(null);
  const totalSteps = sequence.steps.length;

  const load = () => {
    setLoading(true);
    getEnrollments(sequence.id)
      .then((d) => setRows(d.enrollments))
      .finally(() => setLoading(false));
  };
  useEffect(load, [sequence.id]);

  const stop = async (id: string) => {
    setStopping(id);
    try {
      await stopEnrollment(id);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'stopped', nextSendAt: undefined } : r)));
    } finally {
      setStopping(null);
    }
  };

  const progress = (e: SequenceEnrollment): string => {
    if (e.status === 'completed') return 'Completed';
    if (e.status === 'stopped') return `Stopped at step ${Math.min(e.currentStep + 1, totalSteps)}`;
    return `Step ${Math.min(e.currentStep + 1, totalSteps)} of ${totalSteps}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recipients — {sequence.name}</h2>
            <p className="text-xs text-slate-500">
              {rows.length} enrolled · {totalSteps} step{totalSteps === 1 ? '' : 's'} ·{' '}
              <span className={sequence.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}>{sequence.status}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading recipients…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No one enrolled yet. Use “Enroll”, or a study’s Contacts tab → “Add to Sequence”.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Contact</th>
                  <th className="py-2 pr-3">Progress</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Next send</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-800">{e.contactName || e.contactEmail}</div>
                      {e.contactName && <div className="text-xs text-slate-400">{e.contactEmail}</div>}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{progress(e)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[e.status] || 'bg-slate-100 text-slate-500'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{e.status === 'active' ? formatWhen(e.nextSendAt) : '—'}</td>
                    <td className="py-2 text-right">
                      {e.status === 'active' ? (
                        <button
                          onClick={() => stop(e.id)}
                          disabled={stopping === e.id}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {stopping === e.id ? 'Stopping…' : 'Stop'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
