'use client';

import { useMemo, useState } from 'react';
import { createScout, updateScout } from '@/lib/api';
import { therapeuticAreas } from '@/data/therapeuticAreas';
import type { Scout, ScoutConditionRef, StudyPhase, TherapeuticArea } from '@/types';

const PHASE_CHIPS: { value: StudyPhase; label: string }[] = [
  { value: 'PHASE1', label: 'Phase I' },
  { value: 'PHASE2', label: 'Phase II' },
  { value: 'PHASE3', label: 'Phase III' },
  { value: 'PHASE4', label: 'Phase IV' },
  { value: 'NA', label: 'Not Applicable' },
];

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

// One-click countries for the Locations step — most scouts target the US.
const QUICK_COUNTRIES = ['United States', 'Canada', 'Mexico'];

const TABS = ['Basic Info', 'Therapeutic Areas', 'Phases & Keywords', 'Locations'] as const;

const condKey = (areaId: string, conditionId: string) => `${areaId}::${conditionId}`;

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-semibold text-white">
      {count}
    </span>
  );
}

export default function ScoutWizard({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Scout | null;
  onClose: () => void;
  onSaved: (scout: Scout) => void;
}) {
  const editing = !!existing;
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState(existing?.name || '');

  // Step 2 — selected conditions keyed by area::condition
  const [conditions, setConditions] = useState<Record<string, ScoutConditionRef>>(() => {
    const init: Record<string, ScoutConditionRef> = {};
    for (const c of existing?.criteria?.conditions || []) init[condKey(c.areaId, c.id)] = c;
    return init;
  });
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Step 3
  const [phases, setPhases] = useState<StudyPhase[]>(existing?.criteria?.phases || []);
  const [keywords, setKeywords] = useState<string[]>(existing?.criteria?.keywords || []);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(existing?.criteria?.excludeKeywords || []);
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  // Step 4 — new scouts default to the US; edits keep whatever was saved (even none).
  const [locations, setLocations] = useState<string[]>(
    existing ? existing.criteria?.locations || [] : ['United States']
  );
  const [locationInput, setLocationInput] = useState('');
  const toggleLocation = (loc: string) =>
    setLocations((prev) => (prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]));

  // Derived counts
  const conditionCount = Object.keys(conditions).length;
  const refineCount = phases.length + keywords.length + excludeKeywords.length;
  const tabCounts = [name.trim() ? 1 : 0, conditionCount, refineCount, locations.length];
  const hasAnyCriterion = conditionCount > 0 || refineCount > 0 || locations.length > 0;
  const canSave = !!name.trim() && hasAnyCriterion;

  // ---------- Step 2 helpers ----------
  const isSelected = (areaId: string, conditionId: string) => !!conditions[condKey(areaId, conditionId)];
  const areaSelectedCount = (area: TherapeuticArea) =>
    area.conditions.filter((c) => isSelected(area.id, c.id)).length;

  const toggleCondition = (area: TherapeuticArea, conditionId: string, label: string) => {
    const key = condKey(area.id, conditionId);
    setConditions((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else
        next[key] = {
          id: conditionId,
          label,
          areaId: area.id,
          areaName: area.name,
          isCategoryReference: area.isCategoryReference,
        };
      return next;
    });
  };

  const conditionsForArea = (area: TherapeuticArea) => {
    const q = search.trim().toLowerCase();
    if (!q) return area.conditions;
    if (area.name.toLowerCase().includes(q)) return area.conditions;
    return area.conditions.filter((c) => c.label.toLowerCase().includes(q));
  };

  const selectAllInArea = (area: TherapeuticArea) => {
    const list = conditionsForArea(area);
    setConditions((prev) => {
      const next = { ...prev };
      const allSelected = list.every((c) => next[condKey(area.id, c.id)]);
      for (const c of list) {
        const key = condKey(area.id, c.id);
        if (allSelected) delete next[key];
        else
          next[key] = {
            id: c.id,
            label: c.label,
            areaId: area.id,
            areaName: area.name,
            isCategoryReference: area.isCategoryReference,
          };
      }
      return next;
    });
  };

  const visibleAreas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return therapeuticAreas;
    return therapeuticAreas.filter(
      (a) => a.name.toLowerCase().includes(q) || a.conditions.some((c) => c.label.toLowerCase().includes(q))
    );
  }, [search]);

  const isExpanded = (areaId: string) => (search.trim() ? true : expanded.has(areaId));
  const toggleExpanded = (areaId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(areaId) ? next.delete(areaId) : next.add(areaId);
      return next;
    });

  // ---------- Step 3/4 chip helpers ----------
  const addTokens = (raw: string, setter: React.Dispatch<React.SetStateAction<string[]>>, clear: () => void) => {
    const tokens = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setter((prev) => Array.from(new Set([...prev, ...tokens])));
    clear();
  };
  const togglePhase = (value: StudyPhase) =>
    setPhases((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const criteria = {
        conditions: Object.values(conditions),
        phases,
        keywords,
        excludeKeywords,
        locations,
      };
      const color = existing?.color || COLORS[name.trim().length % COLORS.length];
      const scout = editing
        ? await updateScout(existing!.id, { name: name.trim(), criteria, color })
        : await createScout({ name: name.trim(), criteria, color, weeklyReport: true });
      onSaved(scout);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Edit Scout' : 'Create New Scout'}</h2>
              <p className="text-sm text-slate-500">Set up a new Scout to monitor clinical studies.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((label, i) => (
              <button
                key={label}
                onClick={() => setTab(i)}
                className={`flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === i ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {label}
                <Badge count={tabCounts[i]} />
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* STEP 1 — Basic Info */}
          {tab === 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Scout Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 100))}
                placeholder="Oncology Phase 2 Trials in US"
                className={inputCls}
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Give your Scout a descriptive name that clearly identifies what studies it monitors.
                </p>
                <span className="text-xs text-slate-400">{name.length}/100</span>
              </div>

              <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50/60 p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-primary-800">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What is a Scout?
                </h3>
                <p className="text-sm leading-relaxed text-primary-900/80">
                  A Scout monitors clinical studies matching your criteria and sends you weekly reports with new
                  findings. Set up multiple Scouts to track different therapeutic areas or research interests.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 — Therapeutic Areas */}
          {tab === 1 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Select Therapeutic Areas &amp; Conditions</h3>
              <p className="mb-3 text-xs text-slate-500">
                Choose from the predefined list of therapeutic areas and their associated conditions. You can select
                multiple conditions across different therapeutic areas.
              </p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search therapeutic areas or conditions…"
                className={`${inputCls} mb-3`}
              />

              <div className="space-y-2">
                {visibleAreas.map((area) => {
                  const selCount = areaSelectedCount(area);
                  const list = conditionsForArea(area);
                  const open = isExpanded(area.id);
                  const allSelected = list.length > 0 && list.every((c) => isSelected(area.id, c.id));
                  return (
                    <div key={area.id} className="rounded-xl border border-slate-200">
                      <button
                        onClick={() => toggleExpanded(area.id)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left"
                      >
                        <svg
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-slate-800">{area.name}</span>
                        {selCount > 0 && (
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                            {selCount} selected
                          </span>
                        )}
                        {area.isCategoryReference && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            by specialty
                          </span>
                        )}
                        <span className="ml-auto text-xs text-slate-400">{area.conditionCount} conditions</span>
                      </button>

                      {open && (
                        <div className="border-t border-slate-100 px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">Select conditions to monitor</span>
                            <button
                              onClick={() => selectAllInArea(area)}
                              className="text-xs font-medium text-primary-600 hover:underline"
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          {area.isCategoryReference && (
                            <p className="mb-2 text-[11px] text-slate-400">
                              These are specialties — e.g. selecting Cardiology monitors {area.name.toLowerCase()}{' '}
                              cardiology studies.
                            </p>
                          )}
                          {list.length === 0 ? (
                            <p className="text-xs text-slate-400">No conditions match your search.</p>
                          ) : (
                            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                              {list.map((c) => (
                                <label
                                  key={c.id}
                                  className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={isSelected(area.id, c.id)}
                                    onChange={() => toggleCondition(area, c.id, c.label)}
                                  />
                                  <span>{c.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3 — Phases & Keywords */}
          {tab === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Refine Your Search</h3>
                <p className="text-xs text-slate-500">
                  Add clinical trial phases and keywords to further narrow down the studies your Scout monitors. These
                  are optional but help create more targeted results.
                </p>
              </div>

              {/* Phases */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Clinical Trial Phases</label>
                <div className="flex flex-wrap gap-2">
                  {PHASE_CHIPS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => togglePhase(p.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        phases.includes(p.value)
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {phases.length === 0 && (
                  <p className="mt-2 text-xs text-slate-400">No phases selected. Scout will monitor all phases.</p>
                )}
              </div>

              {/* Keywords */}
              <ChipInput
                label="Keywords"
                placeholder="immunotherapy, biomarker (comma-separated)"
                value={keywordInput}
                onChange={setKeywordInput}
                onAdd={() => addTokens(keywordInput, setKeywords, () => setKeywordInput(''))}
                chips={keywords}
                onRemove={(k) => setKeywords((prev) => prev.filter((x) => x !== k))}
                emptyText="No keywords added. Scout will search without keyword filters."
                chipClass="bg-slate-100 text-slate-700"
              />

              {/* Exclude keywords */}
              <ChipInput
                label="Exclude Keywords"
                helper="Studies containing these terms are excluded from results, reports, and emails."
                placeholder="pediatric, placebo (comma-separated)"
                value={excludeInput}
                onChange={setExcludeInput}
                onAdd={() => addTokens(excludeInput, setExcludeKeywords, () => setExcludeInput(''))}
                chips={excludeKeywords}
                onRemove={(k) => setExcludeKeywords((prev) => prev.filter((x) => x !== k))}
                emptyText="No exclude keywords added. All matching studies will be included."
                chipClass="bg-red-50 text-red-700"
              />
            </div>
          )}

          {/* STEP 4 — Locations */}
          {tab === 3 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Geographic Locations</h3>
              <p className="mb-3 text-xs text-slate-500">Add countries to monitor studies in specific regions.</p>

              <div className="mb-4 rounded-xl border border-primary-100 bg-primary-50/60 p-3">
                <h4 className="mb-1 text-xs font-semibold text-primary-800">Location Format</h4>
                <p className="text-xs text-primary-900/80">
                  Enter a country name — examples: &ldquo;United States&rdquo;, &ldquo;Canada&rdquo;, &ldquo;United
                  Kingdom&rdquo;. Multiple countries are allowed.
                </p>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {QUICK_COUNTRIES.map((country) => {
                  const active = locations.includes(country);
                  return (
                    <button
                      key={country}
                      onClick={() => toggleLocation(country)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {country}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTokens(locationInput, setLocations, () => setLocationInput(''));
                    }
                  }}
                  placeholder="United States"
                  className={inputCls}
                />
                <button
                  onClick={() => addTokens(locationInput, setLocations, () => setLocationInput(''))}
                  className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  + Add Location
                </button>
              </div>

              {locations.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">
                  No locations added yet. Add locations above to track studies in specific regions.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {locations.map((loc) => (
                    <li key={loc} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <span>📍 {loc}</span>
                      <button onClick={() => setLocations((prev) => prev.filter((l) => l !== loc))} className="text-slate-400 hover:text-red-500">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Validation warning */}
          {name.trim() && !hasAnyCriterion && (
            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Please add at least one criterion across any tab (Therapeutic Areas, Phases &amp; Keywords, or Locations)
              to create your Scout.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-xs text-slate-400">Step {tab + 1} of 4</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            {tab < 3 ? (
              <button
                onClick={() => setTab((t) => Math.min(3, t + 1))}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSave || saving}
                title={!canSave ? 'Add a name and at least one criterion' : undefined}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Scout'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipInput({
  label,
  helper,
  placeholder,
  value,
  onChange,
  onAdd,
  chips,
  onRemove,
  emptyText,
  chipClass,
}: {
  label: string;
  helper?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  chips: string[];
  onRemove: (chip: string) => void;
  emptyText: string;
  chipClass: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {helper && <p className="mb-2 text-xs text-slate-500">{helper}</p>}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          onClick={onAdd}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          +
        </button>
      </div>
      {chips.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={chip} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${chipClass}`}>
              {chip}
              <button onClick={() => onRemove(chip)} className="hover:text-red-600">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
