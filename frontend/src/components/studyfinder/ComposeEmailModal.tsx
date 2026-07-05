'use client';

import { useState } from 'react';
import { generateAiEmail, sendContactEmail } from '@/lib/api';
import type { DiscoveredContact } from '@/types';

/** One-off email composer for a single discovered contact, with an AI draft option. */
export default function ComposeEmailModal({
  contact,
  company,
  studyTitle,
  onClose,
  onSent,
}: {
  contact: DiscoveredContact;
  company?: string;
  studyTitle?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = async () => {
    setDrafting(true);
    setError(null);
    try {
      const r = await generateAiEmail({
        contactName: contact.name,
        jobTitle: contact.jobTitle,
        company: contact.company || company,
        studyTitle,
        goal: 'introduce our research site and request a brief feasibility conversation',
      });
      setSubject(r.subject);
      setBody(r.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI draft failed. You can write the email manually.');
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!subject.trim() || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await sendContactEmail(contact.id, { subject: subject.trim(), body: body.trim() });
      if (r.success) onSent();
      else setError(r.error || 'Send failed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Email {contact.name}</h2>
            <p className="text-xs text-slate-500">
              To: {contact.email}
              {contact.enrichmentConfidence === 'guessed' && (
                <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">guessed address</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex justify-end">
            <button
              onClick={draft}
              disabled={drafting}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {drafting ? 'Drafting…' : '✨ Draft with AI'}
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!subject.trim() || !body.trim() || sending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  );
}
