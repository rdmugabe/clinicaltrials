'use client';

import { useCallback, useEffect, useState } from 'react';
import { getReportSummary, getReportFilters } from '@/lib/api';
import type { ReportSummary, ReportFilterOptions } from '@/types';

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 truncate text-sm text-slate-600">{label}</div>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 shrink-0 text-right text-sm font-medium text-slate-700">{count}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [options, setOptions] = useState<ReportFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const s = await getReportSummary(active);
      setSummary(s);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    getReportFilters().then(setOptions).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  const selectCls = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm';
  const maxStage = summary ? Math.max(1, ...summary.byStage.map((s) => s.count)) : 1;
  const maxSource = summary ? Math.max(1, ...summary.bySource.map((s) => s.count)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Pipeline analytics across your opportunities.</p>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select value={filters.stage || ''} onChange={(e) => setFilter('stage', e.target.value)} className={selectCls}>
          <option value="">All stages</option>
          {options?.stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filters.assignee || ''} onChange={(e) => setFilter('assignee', e.target.value)} className={selectCls}>
          <option value="">All assignees</option>
          {options?.assignees.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filters.source || ''} onChange={(e) => setFilter('source', e.target.value)} className={selectCls}>
          <option value="">All sources</option>
          {options?.sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filters.pi || ''} onChange={(e) => setFilter('pi', e.target.value)} className={selectCls}>
          <option value="">All PIs</option>
          {options?.pis.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          value={filters.indication || ''}
          onChange={(e) => setFilter('indication', e.target.value)}
          placeholder="Indication"
          className={selectCls}
        />
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({})} className="text-sm text-slate-500 hover:text-slate-800">
            Clear
          </button>
        )}
      </div>

      {loading || !summary ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading reports…</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard label="Total Opportunities" value={summary.totalOpportunities.toLocaleString()} />
            <KpiCard
              label="Avg Time to Close"
              value={summary.avgTimeToCloseDays != null ? `${summary.avgTimeToCloseDays}d` : '—'}
              sub="won + lost"
            />
            <KpiCard
              label="Close Rate"
              value={summary.closeRatePct != null ? `${summary.closeRatePct}%` : '—'}
              sub="awarded / closed"
            />
            <KpiCard label="Total Companies" value={summary.totalCompanies.toLocaleString()} />
            <KpiCard label="Total Contacts" value={summary.totalContacts.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Opportunities by stage</h3>
              {summary.byStage.length === 0 ? (
                <p className="text-sm text-slate-400">No data.</p>
              ) : (
                <div className="space-y-2">
                  {summary.byStage.map((s) => (
                    <BarRow key={s.stage} label={s.stage} count={s.count} max={maxStage} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Opportunities by source</h3>
              {summary.bySource.length === 0 ? (
                <p className="text-sm text-slate-400">No data.</p>
              ) : (
                <div className="space-y-2">
                  {summary.bySource.map((s) => (
                    <BarRow key={s.source} label={s.source} count={s.count} max={maxSource} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
