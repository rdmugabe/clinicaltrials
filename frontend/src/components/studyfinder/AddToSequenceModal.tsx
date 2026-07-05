'use client';

import { useEffect, useState } from 'react';
import { getSequences, enrollContacts } from '@/lib/api';
import type { DiscoveredContact, Sequence } from '@/types';

/** Enroll the selected discovered contacts into a chosen email sequence. */
export default function AddToSequenceModal({
  contacts,
  onClose,
  onEnrolled,
}: {
  contacts: DiscoveredContact[];
  onClose: () => void;
  onEnrolled: (count: number) => void;
}) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [sequenceId, setSequenceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withEmail = contacts.filter((c) => c.email);
  const withoutEmail = contacts.length - withEmail.length;

  useEffect(() => {
    getSequences()
      .then((d) => {
        setSequences(d.sequences);
        if (d.sequences[0]) setSequenceId(d.sequences[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enroll = async () => {
    if (!sequenceId || withEmail.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await enrollContacts(
        sequenceId,
        withEmail.map((c) => ({ contactId: c.id, name: c.name, email: c.email! }))
      );
      onEnrolled(r.enrolled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed.');
    } finally {
      setSaving(false);
    }
  };

  const selected = sequences.find((s) => s.id === sequenceId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-base font-bold text-slate-900">Add to a sequence</h2>
        <p className="mb-4 text-sm text-slate-500">
          Enroll {withEmail.length} contact{withEmail.length === 1 ? '' : 's'} with an email into an outreach sequence.
          {withoutEmail > 0 && (
            <span className="mt-1 block text-xs text-amber-600">
              {withoutEmail} selected contact{withoutEmail === 1 ? '' : 's'} without an email will be skipped — enrich them first.
            </span>
          )}
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Loading sequences…</p>
        ) : sequences.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No sequences yet. Create one in Email Sequences first, then come back.
          </p>
        ) : (
          <>
            <label className="mb-1 block text-xs font-medium text-slate-500">Sequence</label>
            <select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
            {selected && selected.status !== 'active' && (
              <p className="mb-2 text-xs text-amber-600">
                This sequence is {selected.status} — set it Active in Email Sequences for enrolled contacts to receive emails.
              </p>
            )}
          </>
        )}

        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={enroll}
            disabled={saving || withEmail.length === 0 || !sequenceId}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Enrolling…' : `Enroll ${withEmail.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
