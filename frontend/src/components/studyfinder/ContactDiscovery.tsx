'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDiscoveredContacts,
  discoverContacts,
  enrichContact,
  setContactStatus,
  getRelevantTitles,
  getEnrichmentStatus,
  getNoteCounts,
} from '@/lib/api';
import { useShell } from '@/components/shell/AppShell';
import NotesModal from './NotesModal';
import type { DiscoveredContact } from '@/types';

export default function ContactDiscovery({ nctId, company }: { nctId: string; company?: string }) {
  const { refreshAccount } = useShell();
  const [contacts, setContacts] = useState<DiscoveredContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nameQuery, setNameQuery] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [relevantTitles, setRelevantTitles] = useState<string[]>([]);
  const [showTitleHelper, setShowTitleHelper] = useState(false);
  const [enrichmentConfigured, setEnrichmentConfigured] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [notesFor, setNotesFor] = useState<DiscoveredContact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Extract contacts from the study record (idempotent), then read them back.
      const res = await discoverContacts(nctId);
      setContacts(res.contacts);
      getNoteCounts('contact', res.contacts.map((c) => c.id)).then((d) => setNoteCounts(d.counts)).catch(() => {});
    } catch {
      const res = await getDiscoveredContacts(nctId);
      setContacts(res.contacts);
      getNoteCounts('contact', res.contacts.map((c) => c.id)).then((d) => setNoteCounts(d.counts)).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [nctId]);

  useEffect(() => {
    load();
    getRelevantTitles().then((d) => setRelevantTitles(d.titles)).catch(() => {});
    getEnrichmentStatus().then((d) => setEnrichmentConfigured(d.enrichmentConfigured)).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (nameQuery && !c.name.toLowerCase().includes(nameQuery.toLowerCase())) return false;
      if (titleFilter && !(c.jobTitle || '').toLowerCase().includes(titleFilter.toLowerCase())) return false;
      if (locationFilter && !(c.location || '').toLowerCase().includes(locationFilter.toLowerCase())) return false;
      return true;
    });
  }, [contacts, nameQuery, titleFilter, locationFilter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const handleEnrich = async (id: string) => {
    setEnrichingId(id);
    setNotice(null);
    try {
      const updated = await enrichContact(id);
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      refreshAccount();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnrichingId(null);
    }
  };

  const handleAddToSequence = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await setContactStatus(ids, 'In Sequence');
    setContacts((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, status: 'In Sequence' } : c)));
    setNotice(`${ids.length} contact${ids.length > 1 ? 's' : ''} added to sequence.`);
    setSelected(new Set());
  };

  const handleTradeShowList = () => {
    // "Trade Show Attendee List": export the discovered decision-makers as CSV.
    const rows = [
      ['Name', 'Title', 'Company', 'Location', 'Email', 'LinkedIn', 'Status'],
      ...filtered.map((c) => [
        c.name,
        c.jobTitle || '',
        c.company || company || '',
        c.location || '',
        c.email || '',
        c.linkedin || '',
        c.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-show-attendees-${nctId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls =
    'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="Search by name" className={`${inputCls} w-40`} />
        <div className="relative">
          <input
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            onFocus={() => setShowTitleHelper(true)}
            placeholder="Job title"
            className={`${inputCls} w-36`}
          />
          {showTitleHelper && relevantTitles.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTitleHelper(false)} />
              <div className="absolute z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase text-slate-400">Relevant job titles</div>
                {relevantTitles.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTitleFilter(t);
                      setShowTitleHelper(false);
                    }}
                    className="block w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Location" className={`${inputCls} w-32`} />
        <button onClick={handleTradeShowList} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          Trade Show List
        </button>
      </div>

      {!enrichmentConfigured && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Live enrichment provider not configured — emails shown as <em>guessed</em> patterns and LinkedIn search links. Set <code>HUNTER_API_KEY</code> for verified results.
        </p>
      )}
      {notice && <p className="mb-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">{notice}</p>}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
          <span>{selected.size} selected</span>
          <button onClick={handleAddToSequence} className="rounded-md bg-primary-500 px-3 py-1 text-xs font-medium hover:bg-primary-400">
            Add to Sequence
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">Discovering contacts…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
          No contacts found for this study.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Location</th>
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
                  <td className="px-3 py-2 text-slate-600">{c.location || '—'}</td>
                  <td className="px-3 py-2">
                    {c.email || c.linkedin ? (
                      <div className="flex flex-col gap-0.5">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <a href={`mailto:${c.email}`} className="text-primary-600 hover:underline">
                              {c.email}
                            </a>
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.status === 'In Sequence' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
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
          subtitle={[notesFor.jobTitle, notesFor.company || company].filter(Boolean).join(' · ') || undefined}
          entityType="contact"
          entityId={notesFor.id}
          onClose={() => setNotesFor(null)}
          onCountChange={(n) => setNoteCounts((prev) => ({ ...prev, [notesFor.id]: n }))}
        />
      )}
    </div>
  );
}
