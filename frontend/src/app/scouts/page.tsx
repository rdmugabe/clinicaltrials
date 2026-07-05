'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getScouts, updateScout, deleteScout, generateWeeklyReport, getWeeklyReports } from '@/lib/api';
import ScoutWizard from '@/components/studyfinder/ScoutWizard';
import type { Scout, WeeklyReport } from '@/types';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function ScoutsPage() {
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Scout | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'success' } | null>(null);

  const showNotice = (text: string, tone: 'info' | 'success') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([getScouts(), getWeeklyReports()]);
      setScouts(s.scouts);
      setReports(r.reports);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setWizardOpen(true);
  };

  const openEdit = (scout: Scout) => {
    setEditing(scout);
    setWizardOpen(true);
  };

  const handleGenerate = async (id: string) => {
    setBusyId(id);
    try {
      const report = await generateWeeklyReport(id);
      const name = scouts.find((s) => s.id === id)?.name ?? 'Scout';
      if (report.studyCount === 0) {
        showNotice(`${name}: no new studies since the last run.`, 'info');
      } else {
        showNotice(
          `${name}: ${report.studyCount} new ${report.studyCount === 1 ? 'study' : 'studies'} found.`,
          'success'
        );
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleShare = async (scout: Scout) => {
    await updateScout(scout.id, { shared: !scout.shared });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scout and its reports?')) return;
    await deleteScout(id);
    load();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {notice && (
        <div
          className={`fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg ${
            notice.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'
          }`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {notice.tone === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          {notice.text}
          <button onClick={() => setNotice(null)} className="ml-1 opacity-70 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scouts</h1>
          <p className="text-sm text-slate-500">
            Saved, indication-based search agents. Each produces a tailored feed and weekly reports.
          </p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          + New Scout
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading scouts…</div>
      ) : scouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">No scouts yet.</p>
          <p className="mt-1 text-sm text-slate-400">Create a scout for each therapeutic area you cover.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {scouts.map((scout) => {
            const scoutReports = reports.filter((r) => r.scoutId === scout.id);
            return (
              <div key={scout.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: scout.color || COLORS[0] }} />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{scout.name}</div>
                      {scout.indication && <div className="text-xs text-slate-400">{scout.indication}</div>}
                    </div>
                  </div>
                  {scout.shared && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Shared</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  {scout.matchTotal != null && (
                    <Link href={`/scouts/${scout.id}`} className="text-primary-600 hover:underline">
                      <span className="font-semibold">{scout.matchTotal.toLocaleString()}</span> matching
                    </Link>
                  )}
                  {scout.seenNctIds.length > 0 ? (
                    <Link href={`/scouts/${scout.id}?view=tracked`} className="text-primary-600 hover:underline">
                      <span className="font-semibold">{scout.matchCount ?? 0}</span> tracked
                    </Link>
                  ) : (
                    <span>
                      <span className="font-semibold text-slate-700">0</span> tracked
                    </span>
                  )}
                  <span>
                    <span className="font-semibold text-slate-700">{scoutReports.length}</span> reports
                  </span>
                  {scout.weeklyReport && <span className="text-emerald-600">● Weekly report on</span>}
                </div>

                {scoutReports.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Weekly reports
                    </div>
                    {scoutReports.slice(0, 4).map((r) => (
                      <Link
                        key={r.id}
                        href={`/scouts/${scout.id}?report=${r.id}`}
                        className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        <span>Week of {r.weekOf}</span>
                        <span>
                          <span className="font-semibold text-slate-800">{r.studyCount}</span> new{' '}
                          {r.studyCount === 1 ? 'study' : 'studies'} ›
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleGenerate(scout.id)}
                    disabled={busyId === scout.id}
                    className="rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                  >
                    {busyId === scout.id ? 'Running…' : 'Generate report'}
                  </button>
                  <button onClick={() => openEdit(scout)} className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                    Edit
                  </button>
                  <button onClick={() => handleShare(scout)} className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                    {scout.shared ? 'Unshare' : 'Share'}
                  </button>
                  <button onClick={() => handleDelete(scout.id)} className="ml-auto rounded-lg px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {wizardOpen && (
        <ScoutWizard
          existing={editing}
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            setWizardOpen(false);
            load();
          }}
        />
      )}

    </div>
  );
}
