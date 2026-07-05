'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDiscoveredContacts, enrichContact, setContactStatus, getNoteCounts } from '@/lib/api';
import { useShell } from '@/components/shell/AppShell';
import NotesModal from '@/components/studyfinder/NotesModal';
import type { DiscoveredContact } from '@/types';

export default function ContactsPage() {
  const { refreshAccount } = useShell();
  const [contacts, setContacts] = useState<DiscoveredContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [notesFor, setNotesFor] = useState<DiscoveredContact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDiscoveredContacts();
      setContacts(res.contacts);
      const { counts } = await getNoteCounts(
        'contact',
        res.contacts.map((c) => c.id)
      );
      setNoteCounts(counts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.jobTitle || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q)
        );
      }),
    [contacts, query]
  );

  const handleEnrich = async (id: string) => {
    setEnrichingId(id);
    try {
      const updated = await enrichContact(id);
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      refreshAccount();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnrichingId(null);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const addToSequence = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await setContactStatus(ids, 'In Sequence');
    setContacts((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, status: 'In Sequence' } : c)));
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <p className="text-sm text-slate-500">
          People discovered across studies — sponsor, CRO, and site staff. Discover more from any study&apos;s Contacts tab.
        </p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, title, or company"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {selected.size > 0 && (
          <button onClick={addToSequence} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Add {selected.size} to Sequence
          </button>
        )}
        <span className="ml-auto text-sm text-slate-400">{filtered.length} contacts</span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading contacts…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">No contacts discovered yet.</p>
          <p className="mt-1 text-sm text-slate-400">Open a study and use its Contacts tab to discover people.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                  <td className="px-3 py-2 text-slate-600">{c.jobTitle || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{c.company || '—'}</td>
                  <td className="px-3 py-2">
                    {c.email || c.linkedin ? (
                      <div className="flex flex-col gap-0.5">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <a href={`mailto:${c.email}`} className="text-primary-600 hover:underline">{c.email}</a>
                            {c.enrichmentConfidence === 'guessed' && (
                              <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700">guessed</span>
                            )}
                          </span>
                        )}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                            LinkedIn ↗
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEnrich(c.id)}
                        disabled={enrichingId === c.id}
                        className="rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                      >
                        {enrichingId === c.id ? 'Enriching…' : 'Enrich'}
                      </button>
                    )}
                  </td>
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
    </div>
  );
}
