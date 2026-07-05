'use client';

import { useCallback, useEffect, useState } from 'react';
import { searchCompanies } from '@/lib/api';
import CompanyDetailPanel from '@/components/studyfinder/CompanyDetailPanel';
import type { CompanySummary } from '@/types';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [indication, setIndication] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchCompanies({ query: query.trim() || undefined, indication: indication.trim() || undefined });
      setCompanies(res.companies);
    } finally {
      setLoading(false);
    }
  }, [query, indication]);

  useEffect(() => {
    load();
  }, []); // initial load only; searches are submitted explicitly

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const inputCls =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
        <p className="text-sm text-slate-500">
          Sponsors, biotech, CRO, and MedTech firms — aggregated live from ClinicalTrials.gov. Filter by indication.
        </p>
      </div>

      <form onSubmit={submit} className="mb-5 flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company name" className={`${inputCls} w-56`} />
        <input value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="Indication (e.g. oncology)" className={`${inputCls} w-56`} />
        <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Search
        </button>
        {(query || indication) && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIndication('');
              setTimeout(load, 0);
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-slate-400">{companies.length} companies</span>
      </form>

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-3 text-sm text-slate-500">Loading companies…</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">No companies found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c.name)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{c.name}</h3>
              </div>
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">{c.type}</span>
                <span className="text-slate-500">{c.studyCount} studies</span>
              </div>
              {c.indications.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.indications.slice(0, 3).map((i) => (
                    <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{i}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && <CompanyDetailPanel name={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
