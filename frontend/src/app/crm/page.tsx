'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDiscoveredContacts,
  getCompanies,
  createCompany,
  importCompanies,
  deleteCompany,
  getNoteCounts,
} from '@/lib/api';
import NotesModal from '@/components/studyfinder/NotesModal';
import type { DiscoveredContact, CrmCompany } from '@/types';

type Tab = 'contacts' | 'companies';

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<DiscoveredContact[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [importing, setImporting] = useState(false);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [notesFor, setNotesFor] = useState<DiscoveredContact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, co] = await Promise.all([getDiscoveredContacts(), getCompanies()]);
      setContacts(c.contacts);
      setCompanies(co.companies);
      const { counts } = await getNoteCounts('contact', c.contacts.map((x) => x.id));
      setNoteCounts(counts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredContacts = useMemo(() => {
    if (!query) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.jobTitle || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const filteredCompanies = useMemo(() => {
    if (!query) return companies;
    const q = query.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q) || (c.type || '').toLowerCase().includes(q));
  }, [companies, query]);

  const handleImport = async () => {
    setImporting(true);
    try {
      await importCompanies();
      const co = await getCompanies();
      setCompanies(co.companies);
    } finally {
      setImporting(false);
    }
  };

  const removeCompany = async (id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    await deleteCompany(id);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">CRM — Contacts &amp; Companies</h1>
        <p className="text-sm text-slate-500">Your saved contacts and company directory.</p>
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-slate-200">
        {(['contacts', 'companies'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t} ({t === 'contacts' ? contacts.length : companies.length})
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {tab === 'companies' && (
          <div className="ml-auto flex gap-2">
            <button onClick={handleImport} disabled={importing} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {importing ? 'Importing…' : 'Import from pipeline'}
            </button>
            <button onClick={() => setShowAddCompany(true)} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
              + Company
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
      ) : tab === 'contacts' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                  <td className="px-3 py-2">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-primary-600 hover:underline">{c.email}</a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.jobTitle || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{c.company || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === 'In Sequence' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setNotesFor(c)}
                      className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Notes
                      {noteCounts[c.id] ? (
                        <span className="rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white">
                          {noteCounts[c.id]}
                        </span>
                      ) : null}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredContacts.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No contacts yet — discover people from a study&apos;s Contacts tab.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">HQ</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompanies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                  <td className="px-3 py-2">
                    {c.type ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{c.type}</span> : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.hq || '—'}</td>
                  <td className="px-3 py-2">
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                        {c.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeCompany(c.id)} className="text-xs text-slate-400 hover:text-red-500">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCompanies.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No companies yet — import from your pipeline or add one.
            </div>
          )}
        </div>
      )}

      {notesFor && (
        <NotesModal
          title={`Notes — ${notesFor.name}`}
          subtitle={[notesFor.jobTitle, notesFor.company].filter(Boolean).join(' · ') || undefined}
          entityType="contact"
          entityId={notesFor.id}
          onClose={() => setNotesFor(null)}
          onCountChange={(n) => setNoteCounts((prev) => ({ ...prev, [notesFor.id]: n }))}
        />
      )}

      {showAddCompany && (
        <AddCompanyModal
          onClose={() => setShowAddCompany(false)}
          onAdded={(company) => {
            setCompanies((prev) => [...prev, company].sort((a, b) => a.name.localeCompare(b.name)));
            setShowAddCompany(false);
          }}
        />
      )}
    </div>
  );
}

function AddCompanyModal({ onClose, onAdded }: { onClose: () => void; onAdded: (c: CrmCompany) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Sponsor');
  const [hq, setHq] = useState('');
  const [website, setWebsite] = useState('');
  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

  const submit = async () => {
    if (!name.trim()) return;
    const company = await createCompany({ name: name.trim(), type, hq: hq.trim() || undefined, website: website.trim() || undefined });
    onAdded(company);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-slate-900">Add Company</h3>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name *" className={inputCls} />
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {['Sponsor', 'CRO', 'Biotech', 'Pharma', 'MedTech', 'Other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="HQ location" className={inputCls} />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" className={inputCls} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={submit} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
