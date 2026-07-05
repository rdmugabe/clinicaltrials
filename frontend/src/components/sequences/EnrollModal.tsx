'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDiscoveredContacts, enrollContacts } from '@/lib/api';
import type { Sequence, DiscoveredContact } from '@/types';

export default function EnrollModal({
  sequence,
  onClose,
  onEnrolled,
}: {
  sequence: Sequence;
  onClose: () => void;
  onEnrolled: (count: number) => void;
}) {
  const [contacts, setContacts] = useState<DiscoveredContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDiscoveredContacts()
      .then((d) => setContacts(d.contacts.filter((c) => c.email)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query) return contacts;
    const q = query.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q));
  }, [contacts, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const enroll = async () => {
    const picked = contacts.filter((c) => selected.has(c.id));
    if (picked.length === 0) return;
    setSaving(true);
    try {
      const res = await enrollContacts(
        sequence.id,
        picked.map((c) => ({ contactId: c.id, name: c.name, email: c.email! }))
      );
      onEnrolled(res.enrolled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-slate-900">Enroll contacts</h3>
        <p className="mb-4 text-sm text-slate-500">
          Add contacts to <span className="font-medium text-slate-700">{sequence.name}</span>. Only contacts with an
          email are shown.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading contacts…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No contacts with emails yet. Enrich contacts in the Contacts tab first.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">{c.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {c.email} {c.company ? `· ${c.company}` : ''}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <span className="mr-auto text-sm text-slate-500">{selected.size} selected</span>
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={enroll}
            disabled={saving || selected.size === 0}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Enrolling…' : `Enroll ${selected.size || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
