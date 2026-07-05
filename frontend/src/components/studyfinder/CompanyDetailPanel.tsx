'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCompanyDetail, getDiscoveredContacts } from '@/lib/api';
import StudyDetailPanel from './StudyDetailPanel';
import type { CompanyDetail, DiscoveredContact } from '@/types';

const TABS = ['Overview', 'Contacts', 'Studies', 'News / Press'] as const;
type Tab = (typeof TABS)[number];

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? <span className="text-slate-400">Not available</span>}</dd>
    </div>
  );
}

export default function CompanyDetailPanel({ name, onClose }: { name: string; onClose: () => void }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [contacts, setContacts] = useState<DiscoveredContact[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getCompanyDetail(name)
      .then(setCompany)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load company'))
      .finally(() => setLoading(false));
    getDiscoveredContacts().then((d) => setContacts(d.contacts)).catch(() => {});
  }, [name]);

  const companyContacts = useMemo(
    () => contacts.filter((c) => (c.company || '').toLowerCase() === name.toLowerCase()),
    [contacts, name]
  );

  const newsUrl = `https://news.google.com/search?q=${encodeURIComponent(name)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug text-slate-900">{name}</h2>
              {company && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">{company.type}</span>
                  <span className="text-slate-500">{company.studyCount.toLocaleString()} studies</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 px-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
            </div>
          ) : error || !company ? (
            <p className="text-sm text-red-600">{error || 'Not found'}</p>
          ) : tab === 'Overview' ? (
            <div>
              <dl className="mb-6 grid grid-cols-2 gap-4">
                <Field label="Type" value={company.type} />
                <Field label="Total studies" value={company.studyCount.toLocaleString()} />
                <Field label="HQ location" value={company.firmographics.hq} />
                <Field label="Website" value={company.firmographics.website} />
                <Field label="Employees" value={company.firmographics.employees} />
                <Field label="Founded" value={company.firmographics.founded} />
              </dl>
              <p className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Firmographics (description, HQ, headcount, founding year) require a data provider. Connect enrichment to
                populate them; everything else here is live from ClinicalTrials.gov.
              </p>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Top indications</h4>
              <div className="mb-5 flex flex-wrap gap-1">
                {company.indications.map((i) => (
                  <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{i}</span>
                ))}
              </div>
              {company.countries.length > 0 && (
                <>
                  <h4 className="mb-2 text-sm font-semibold text-slate-900">Trial countries ({company.countries.length})</h4>
                  <div className="flex flex-wrap gap-1">
                    {company.countries.slice(0, 20).map((c) => (
                      <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{c}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : tab === 'Contacts' ? (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                Contacts already discovered for {name}. Open a study&apos;s Contacts tab to discover more.
              </p>
              {companyContacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  No contacts discovered for this company yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {companyContacts.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                          <td className="px-3 py-2 text-slate-600">{c.jobTitle || '—'}</td>
                          <td className="px-3 py-2">
                            {c.email ? (
                              <a href={`mailto:${c.email}`} className="text-primary-600 hover:underline">{c.email}</a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : tab === 'Studies' ? (
            <div className="space-y-2">
              {company.studies.map((s) => (
                <button
                  key={s.nctId}
                  onClick={() => setSelectedStudy(s.nctId)}
                  className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-primary-300 hover:bg-slate-50"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    {s.phase !== 'N/A' && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-primary-700">{s.phase}</span>}
                    <span className="font-mono text-slate-400">{s.nctId}</span>
                    <span className="ml-auto text-slate-500">{s.feedStatus}</span>
                  </div>
                  <div className="line-clamp-2 text-sm font-medium text-slate-800">{s.title}</div>
                </button>
              ))}
            </div>
          ) : (
            /* News / Press */
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm text-slate-600">News &amp; press aggregation requires a news provider.</p>
              <a
                href={newsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Search {name} news ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {selectedStudy && <StudyDetailPanel nctId={selectedStudy} onClose={() => setSelectedStudy(null)} />}
    </div>
  );
}
