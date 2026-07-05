'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getSequenceMetrics,
  getSequences,
  setSequenceStatus,
  deleteSequence,
  getSignatures,
  createSignature,
  deleteSignature,
  getMailbox,
  connectMailbox,
  disconnectMailbox,
} from '@/lib/api';
import type { Sequence, SequenceMetrics, Signature, Mailbox } from '@/types';
import SequenceEditor from '@/components/sequences/SequenceEditor';
import EnrollModal from '@/components/sequences/EnrollModal';

type Tab = 'metrics' | 'sequences' | 'signatures' | 'mailbox';

export default function SequencesPage() {
  return <SequencesApp />;
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === 'warn' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function SequencesApp() {
  const [tab, setTab] = useState<Tab>('metrics');
  const [metrics, setMetrics] = useState<SequenceMetrics | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [editing, setEditing] = useState<Sequence | 'new' | null>(null);
  const [enrolling, setEnrolling] = useState<Sequence | null>(null);

  const load = useCallback(async () => {
    const [m, s, sig, mb] = await Promise.all([getSequenceMetrics(), getSequences(), getSignatures(), getMailbox()]);
    setMetrics(m);
    setSequences(s.sequences);
    setSignatures(sig.signatures);
    setMailbox(mb);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async (seq: Sequence) => {
    const updated = await setSequenceStatus(seq.id, seq.status === 'active' ? 'paused' : 'active');
    setSequences((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    getSequenceMetrics().then(setMetrics);
  };

  const removeSequence = async (id: string) => {
    if (!confirm('Delete this sequence and its enrollments?')) return;
    await deleteSequence(id);
    setSequences((prev) => prev.filter((s) => s.id !== id));
    getSequenceMetrics().then(setMetrics);
  };

  const statusStyle: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-amber-100 text-amber-700',
    draft: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Sequences</h1>
          <p className="text-sm text-slate-500">Automated multi-step outreach to sponsors, CROs, and contacts.</p>
        </div>
        {tab === 'sequences' && (
          <button onClick={() => setEditing('new')} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            + New Sequence
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center gap-1 border-b border-slate-200">
        {(['metrics', 'sequences', 'signatures', 'mailbox'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* METRICS */}
      {tab === 'metrics' && metrics && (
        <div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <Kpi label="Active" value={metrics.activeSequences} />
            <Kpi label="Sent" value={metrics.emailsSent} />
            <Kpi label="In Queue" value={metrics.inQueue} />
            <Kpi label="Bounced" value={metrics.bounced} tone="warn" />
            <Kpi label="Opened" value={metrics.opened} />
            <Kpi label="Replied" value={metrics.replied} />
            <Kpi label="Open Rate" value={`${metrics.avgOpenRate}%`} />
          </div>
          {!mailbox?.connected && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No mailbox connected — sends are simulated and open/reply tracking is unavailable. Connect a mailbox in
              the Mailbox tab to send for real.
            </p>
          )}
        </div>
      )}

      {/* SEQUENCES */}
      {tab === 'sequences' && (
        <div className="space-y-3">
          {sequences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <p className="text-slate-600">No sequences yet.</p>
              <p className="mt-1 text-sm text-slate-400">Create a multi-step sequence to start automating outreach.</p>
            </div>
          ) : (
            sequences.map((seq) => (
              <div key={seq.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{seq.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle[seq.status]}`}>{seq.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''} · {seq.enrolledCount ?? 0} enrolled
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setEnrolling(seq)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                      Enroll
                    </button>
                    <button onClick={() => setEditing(seq)} className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                      Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(seq)}
                      disabled={seq.steps.length === 0}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                        seq.status === 'active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {seq.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button onClick={() => removeSequence(seq.id)} className="rounded-lg px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SIGNATURES */}
      {tab === 'signatures' && (
        <SignaturesTab signatures={signatures} onChange={(list) => setSignatures(list)} />
      )}

      {/* MAILBOX */}
      {tab === 'mailbox' && mailbox && <MailboxTab mailbox={mailbox} onChange={setMailbox} />}

      {editing && (
        <SequenceEditor
          sequence={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(seq) => {
            setEditing(null);
            setSequences((prev) => {
              const exists = prev.some((s) => s.id === seq.id);
              return exists ? prev.map((s) => (s.id === seq.id ? seq : s)) : [seq, ...prev];
            });
          }}
        />
      )}
      {enrolling && (
        <EnrollModal
          sequence={enrolling}
          onClose={() => setEnrolling(null)}
          onEnrolled={() => {
            setEnrolling(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SignaturesTab({ signatures, onChange }: { signatures: Signature[]; onChange: (list: Signature[]) => void }) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const add = async () => {
    if (!name.trim() || !body.trim()) return;
    const sig = await createSignature(name.trim(), body.trim());
    onChange([sig, ...signatures]);
    setName('');
    setBody('');
  };
  const remove = async (id: string) => {
    await deleteSignature(id);
    onChange(signatures.filter((s) => s.id !== id));
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">New signature</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Signature name" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="— Jane Doe, BD Lead, My Research Site" rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button onClick={add} className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Save signature
        </button>
      </div>
      <div className="space-y-2">
        {signatures.length === 0 ? (
          <p className="text-sm text-slate-400">No signatures yet.</p>
        ) : (
          signatures.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{s.name}</span>
                <button onClick={() => remove(s.id)} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{s.body}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MailboxTab({ mailbox, onChange }: { mailbox: Mailbox; onChange: (m: Mailbox) => void }) {
  const [fromEmail, setFromEmail] = useState(mailbox.fromEmail || '');
  const [fromName, setFromName] = useState(mailbox.fromName || '');

  const connect = async () => {
    if (!fromEmail.trim()) return;
    onChange(await connectMailbox({ fromEmail: fromEmail.trim(), fromName: fromName.trim() || undefined }));
  };
  const disconnect = async () => onChange(await disconnectMailbox());

  return (
    <div className="max-w-md rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${mailbox.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className="text-sm font-medium text-slate-800">
          {mailbox.connected ? `Connected — ${mailbox.fromEmail}` : 'No mailbox connected'}
        </span>
      </div>
      <label className="mb-1 block text-xs font-medium text-slate-500">From email</label>
      <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="you@yoursite.org" className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <label className="mb-1 block text-xs font-medium text-slate-500">From name</label>
      <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Jane Doe" className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={connect} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          {mailbox.connected ? 'Update' : 'Connect mailbox'}
        </button>
        {mailbox.connected && (
          <button onClick={disconnect} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Disconnect
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        With no live email provider configured, sends are simulated for the queue and metrics.
      </p>
    </div>
  );
}
