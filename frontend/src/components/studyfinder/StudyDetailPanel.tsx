'use client';

import { useEffect, useState } from 'react';
import { getStudy, pushToPipeline } from '@/lib/api';
import ContactDiscovery from './ContactDiscovery';
import NotesPanel from './NotesPanel';
import type { Study, StudyStatus } from '@/types';

const TABS = [
  'Quick View',
  'Overview',
  'Eligibility',
  'Locations',
  'Study Design',
  'Interventions',
  'Outcomes',
  'Timeline',
  'References',
  'Contacts',
  'Notes',
] as const;
type Tab = (typeof TABS)[number];

const STATUS_STYLES: Record<string, string> = {
  RECRUITING: 'bg-emerald-100 text-emerald-700',
  NOT_YET_RECRUITING: 'bg-amber-100 text-amber-700',
  ENROLLING_BY_INVITATION: 'bg-emerald-100 text-emerald-700',
  ACTIVE_NOT_RECRUITING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  TERMINATED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  WITHDRAWN: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-slate-100 text-slate-500',
};

function humanStatus(s: StudyStatus): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h4 className="mb-2 text-sm font-semibold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

// Split a raw eligibility criteria blob into inclusion / exclusion lists.
function splitCriteria(text?: string): { inclusion: string[]; exclusion: string[] } {
  if (!text) return { inclusion: [], exclusion: [] };
  const lower = text.toLowerCase();
  const exIdx = lower.indexOf('exclusion criteria');
  const inStart = lower.indexOf('inclusion criteria');
  const toLines = (chunk: string) =>
    chunk
      .split('\n')
      .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
      .filter((l) => l && !/^(inclusion|exclusion) criteria:?$/i.test(l));

  if (exIdx === -1) {
    return { inclusion: toLines(inStart === -1 ? text : text.slice(inStart)), exclusion: [] };
  }
  const incChunk = text.slice(inStart === -1 ? 0 : inStart, exIdx);
  const excChunk = text.slice(exIdx);
  return { inclusion: toLines(incChunk), exclusion: toLines(excChunk) };
}

export default function StudyDetailPanel({
  nctId,
  onClose,
  onPushed,
}: {
  nctId: string;
  onClose: () => void;
  onPushed?: () => void;
}) {
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Quick View');
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);

  useEffect(() => {
    setLoading(true);
    getStudy(nctId)
      .then((s) => setStudy(s))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load study'))
      .finally(() => setLoading(false));
  }, [nctId]);

  const p = study?.protocolSection;
  const id = p?.identificationModule;
  const status = p?.statusModule;
  const design = p?.designModule;
  const sponsor = p?.sponsorCollaboratorsModule?.leadSponsor;
  const elig = p?.eligibilityModule;
  const conditions = p?.conditionsModule?.conditions || [];

  const handlePush = async () => {
    if (!p || !id) return;
    setPushing(true);
    try {
      await pushToPipeline({
        nctId: id.nctId,
        title: id.briefTitle,
        sponsor: sponsor?.name,
        indications: conditions,
      });
      setPushed(true);
      onPushed?.();
    } finally {
      setPushing(false);
    }
  };

  const renderTab = () => {
    if (!p || !id || !status) return null;
    const date = (s?: string) => (s ? new Date(s).toLocaleDateString() : '—');

    switch (tab) {
      case 'Quick View':
        return (
          <div>
            {p.descriptionModule?.briefSummary && (
              <p className="mb-4 text-sm leading-relaxed text-slate-600 line-clamp-6">
                {p.descriptionModule.briefSummary}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Status" value={humanStatus(status.overallStatus)} />
              <Field label="Phase" value={design?.phases?.join(', ') || 'N/A'} />
              <Field label="Enrollment" value={design?.enrollmentInfo?.count?.toLocaleString()} />
              <Field label="Sponsor" value={sponsor?.name} />
              <Field label="Start date" value={date(status.startDateStruct?.date)} />
              <Field label="Study type" value={design?.studyType} />
            </dl>
            {conditions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {conditions.map((c) => (
                  <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 'Overview':
        return (
          <div>
            <Section title="Brief summary">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {p.descriptionModule?.briefSummary || 'No summary provided.'}
              </p>
            </Section>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Status" value={humanStatus(status.overallStatus)} />
              <Field label="Phase" value={design?.phases?.join(', ') || 'N/A'} />
              <Field label="Enrollment" value={`${design?.enrollmentInfo?.count?.toLocaleString() ?? '—'} (${design?.enrollmentInfo?.type ?? '—'})`} />
              <Field label="Start date" value={date(status.startDateStruct?.date)} />
              <Field label="Primary completion" value={date(status.primaryCompletionDateStruct?.date)} />
              <Field label="Last updated" value={date(status.lastUpdatePostDateStruct?.date)} />
              <Field label="Lead sponsor" value={sponsor?.name} />
              <Field label="Sponsor type" value={sponsor?.class} />
            </dl>
          </div>
        );

      case 'Eligibility': {
        const { inclusion, exclusion } = splitCriteria(elig?.eligibilityCriteria);
        return (
          <div>
            <dl className="mb-5 grid grid-cols-2 gap-4">
              <Field label="Age range" value={[elig?.minimumAge, elig?.maximumAge].filter(Boolean).join(' – ') || '—'} />
              <Field label="Sex" value={elig?.sex} />
              <Field label="Healthy volunteers" value={elig?.healthyVolunteers ? 'Accepts' : 'No'} />
              <Field label="Age groups" value={elig?.stdAges?.join(', ')} />
            </dl>
            {inclusion.length > 0 && (
              <Section title="Inclusion criteria">
                <ul className="space-y-1">
                  {inclusion.map((l, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {l}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {exclusion.length > 0 && (
              <Section title="Exclusion criteria">
                <ul className="space-y-1">
                  {exclusion.map((l, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      {l}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {inclusion.length === 0 && exclusion.length === 0 && (
              <p className="text-sm text-slate-500">No eligibility criteria provided.</p>
            )}
          </div>
        );
      }

      case 'Locations': {
        const locations = p.contactsLocationsModule?.locations || [];
        return locations.length === 0 ? (
          <p className="text-sm text-slate-500">No locations listed.</p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-800">{loc.facility || 'Unnamed facility'}</div>
                <div className="text-xs text-slate-500">
                  {[loc.city, loc.state, loc.country].filter(Boolean).join(', ')}
                </div>
                {loc.status && <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{loc.status}</span>}
              </div>
            ))}
          </div>
        );
      }

      case 'Study Design': {
        const di = design?.designInfo;
        return (
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Study type" value={design?.studyType} />
            <Field label="Phases" value={design?.phases?.join(', ') || 'N/A'} />
            <Field label="Allocation" value={di?.allocation} />
            <Field label="Intervention model" value={di?.interventionModel} />
            <Field label="Primary purpose" value={di?.primaryPurpose} />
            <Field label="Masking" value={di?.maskingInfo?.masking} />
            <Field label="Enrollment" value={design?.enrollmentInfo?.count?.toLocaleString()} />
          </dl>
        );
      }

      case 'Interventions': {
        const interventions = p.armsInterventionsModule?.interventions || [];
        return interventions.length === 0 ? (
          <p className="text-sm text-slate-500">No interventions listed.</p>
        ) : (
          <div className="space-y-3">
            {interventions.map((iv, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">{iv.type}</span>
                  <span className="text-sm font-medium text-slate-800">{iv.name}</span>
                </div>
                {iv.description && <p className="mt-1 text-sm text-slate-600">{iv.description}</p>}
              </div>
            ))}
          </div>
        );
      }

      case 'Outcomes': {
        const primary = p.outcomesModule?.primaryOutcomes || [];
        const secondary = p.outcomesModule?.secondaryOutcomes || [];
        const renderOutcomes = (list: typeof primary) =>
          list.map((o, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-800">{o.measure}</div>
              {o.description && <p className="mt-1 text-sm text-slate-600">{o.description}</p>}
              {o.timeFrame && <p className="mt-1 text-xs text-slate-400">Time frame: {o.timeFrame}</p>}
            </div>
          ));
        return primary.length === 0 && secondary.length === 0 ? (
          <p className="text-sm text-slate-500">No outcome measures listed.</p>
        ) : (
          <div>
            {primary.length > 0 && <Section title="Primary outcomes"><div className="space-y-2">{renderOutcomes(primary)}</div></Section>}
            {secondary.length > 0 && <Section title="Secondary outcomes"><div className="space-y-2">{renderOutcomes(secondary)}</div></Section>}
          </div>
        );
      }

      case 'Timeline':
        return (
          <dl className="grid grid-cols-2 gap-4">
            <Field label="First submitted" value={date(status.studyFirstSubmitDate)} />
            <Field label="First posted" value={date(status.studyFirstPostDateStruct?.date)} />
            <Field label="Start date" value={date(status.startDateStruct?.date)} />
            <Field label="Primary completion" value={date(status.primaryCompletionDateStruct?.date)} />
            <Field label="Completion" value={date(status.completionDateStruct?.date)} />
            <Field label="Last updated" value={date(status.lastUpdatePostDateStruct?.date)} />
          </dl>
        );

      case 'References': {
        const refs = p.referencesModule?.references || [];
        return refs.length === 0 ? (
          <p className="text-sm text-slate-500">No references listed.</p>
        ) : (
          <ul className="space-y-2">
            {refs.map((r, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                {r.citation || 'Reference'}
                {r.pmid && (
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-primary-600 hover:underline"
                  >
                    PMID {r.pmid} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        );
      }

      case 'Contacts':
        return <ContactDiscovery nctId={id.nctId} company={sponsor?.name} />;

      case 'Notes':
        return <NotesPanel entityType="study" entityId={id.nctId} />;

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{nctId}</span>
                {status && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status.overallStatus] || 'bg-slate-100 text-slate-500'}`}>
                    {humanStatus(status.overallStatus)}
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold leading-snug text-slate-900">
                {id?.briefTitle || (loading ? 'Loading…' : 'Study')}
              </h2>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <a
              href={`https://clinicaltrials.gov/study/${nctId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              View on ClinicalTrials.gov ↗
            </a>
            <button
              onClick={handlePush}
              disabled={pushing || pushed}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                pushed ? 'cursor-default bg-emerald-50 text-emerald-600' : 'bg-primary-600 text-white hover:bg-primary-700'
              } disabled:opacity-70`}
            >
              {pushed ? '✓ In TrialTrack' : pushing ? 'Adding…' : 'Open in TrialTrack'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4">
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
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            renderTab()
          )}
        </div>
      </div>
    </div>
  );
}
