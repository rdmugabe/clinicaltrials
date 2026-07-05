'use client';

import { useEffect, useState } from 'react';
import { createSequence, updateSequence, getAiStatus, generateAiSequence } from '@/lib/api';
import { useShell } from '@/components/shell/AppShell';
import type { Sequence, SequenceStep } from '@/types';

export default function SequenceEditor({
  sequence,
  onClose,
  onSaved,
}: {
  sequence: Sequence | null;
  onClose: () => void;
  onSaved: (seq: Sequence) => void;
}) {
  const { refreshAccount } = useShell();
  const [name, setName] = useState(sequence?.name || '');
  const [steps, setSteps] = useState<SequenceStep[]>(
    sequence?.steps.length ? sequence.steps : [{ subject: '', body: '', delayDays: 0 }]
  );
  const [saving, setSaving] = useState(false);

  // AI drafting
  const [aiConfigured, setAiConfigured] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [indication, setIndication] = useState('');
  const [audience, setAudience] = useState('');
  const [aiSteps, setAiSteps] = useState(3);

  useEffect(() => {
    getAiStatus().then((s) => setAiConfigured(s.configured)).catch(() => setAiConfigured(false));
  }, []);

  const draftWithAi = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await generateAiSequence({
        indication: indication.trim() || undefined,
        audience: audience.trim() || undefined,
        steps: aiSteps,
      });
      if (!name.trim()) setName(result.name);
      setSteps(result.steps.length ? result.steps : steps);
      setShowAi(false);
      refreshAccount();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setAiBusy(false);
    }
  };

  const updateStep = (i: number, patch: Partial<SequenceStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addStep = () => setSteps((prev) => [...prev, { subject: '', body: '', delayDays: 3 }]);
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) return;
    const cleanSteps = steps
      .filter((s) => s.subject.trim() || s.body.trim())
      .map((s) => ({ subject: s.subject.trim(), body: s.body.trim(), delayDays: Number(s.delayDays) || 0 }));
    setSaving(true);
    try {
      const seq = sequence
        ? await updateSequence(sequence.id, { name: name.trim(), steps: cleanSteps })
        : await createSequence({ name: name.trim(), steps: cleanSteps });
      onSaved(seq);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{sequence ? 'Edit Sequence' : 'New Sequence'}</h3>
          <button
            onClick={() => setShowAi((s) => !s)}
            disabled={!aiConfigured}
            title={aiConfigured ? 'Draft this sequence with Claude' : 'Set ANTHROPIC_API_KEY to enable AI drafting'}
            className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3z" />
            </svg>
            Draft with AI
          </button>
        </div>

        {showAi && (
          <div className="mb-5 rounded-xl border border-primary-200 bg-primary-50/50 p-4">
            <p className="mb-3 text-xs text-slate-600">
              Describe who you&apos;re targeting and Claude will draft the steps. Uses credits.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="Indication (e.g. Oncology)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience (e.g. Clin Ops leaders)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-slate-500">Steps</label>
              <input type="number" min={1} max={6} value={aiSteps} onChange={(e) => setAiSteps(Number(e.target.value))} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
              <button onClick={draftWithAi} disabled={aiBusy} className="ml-auto rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {aiBusy ? 'Drafting…' : 'Generate steps'}
              </button>
            </div>
            {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}
          </div>
        )}

        <label className="mb-1 block text-xs font-medium text-slate-500">Sequence name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sponsor intro cadence" className={`${inputCls} mb-5`} />

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Step {i + 1}</span>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">Send</span>
                {i === 0 ? (
                  <span className="text-xs font-medium text-slate-700">immediately</span>
                ) : (
                  <>
                    <input
                      type="number"
                      min={0}
                      value={step.delayDays}
                      onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-slate-500">days after previous step</span>
                  </>
                )}
              </div>
              <input value={step.subject} onChange={(e) => updateStep(i, { subject: e.target.value })} placeholder="Subject" className={`${inputCls} mb-2`} />
              <textarea
                value={step.body}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                placeholder="Body — use {{name}} to personalize"
                rows={4}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        <button onClick={addStep} className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
          + Add step
        </button>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !name.trim()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save sequence'}
          </button>
        </div>
      </div>
    </div>
  );
}
