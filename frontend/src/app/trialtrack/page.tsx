'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getBoards,
  createBoard,
  updateBoard,
  getPipeline,
  pushToPipeline,
  updateOpportunityStage,
  deleteOpportunity,
} from '@/lib/api';
import AssigneeSelect from '@/components/AssigneeSelect';
import type { Board, PipelineOpportunity } from '@/types';

const STAGE_ACCENT: Record<string, string> = {
  Awarded: 'border-t-emerald-400',
  Lost: 'border-t-red-300',
  Active: 'border-t-emerald-400',
};

export default function TrialTrackPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [opps, setOpps] = useState<PipelineOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  const loadBoards = useCallback(async () => {
    const res = await getBoards();
    setBoards(res.boards);
    setActiveBoardId((cur) => cur || res.boards[0]?.id || null);
  }, []);

  const loadOpps = useCallback(async () => {
    if (!activeBoard) return;
    setLoading(true);
    try {
      const res = await getPipeline(activeBoard.name);
      setOpps(res.opportunities);
    } finally {
      setLoading(false);
    }
  }, [activeBoard]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    loadOpps();
  }, [loadOpps]);

  const filtered = useMemo(() => {
    if (!query) return opps;
    const q = query.toLowerCase();
    return opps.filter(
      (o) => o.title.toLowerCase().includes(q) || (o.sponsor || '').toLowerCase().includes(q)
    );
  }, [opps, query]);

  const move = async (id: string, stage: string) => {
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o)));
    await updateOpportunityStage(id, stage);
  };

  const handleDrop = (stage: string) => {
    if (dragId) move(dragId, stage);
    setDragId(null);
    setDragOver(null);
  };

  const remove = async (id: string) => {
    setOpps((prev) => prev.filter((o) => o.id !== id));
    await deleteOpportunity(id);
  };

  const addStage = async () => {
    if (!activeBoard) return;
    const name = prompt('New stage name');
    if (!name?.trim()) return;
    const updated = await updateBoard(activeBoard.id, { stages: [...activeBoard.stages, name.trim()] });
    setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const addBoard = async () => {
    const name = prompt('New board name');
    if (!name?.trim()) return;
    const board = await createBoard(name.trim());
    setBoards((prev) => [...prev, board]);
    setActiveBoardId(board.id);
  };

  const stages = activeBoard?.stages || [];

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">TrialTrack — Study Tracker</h1>
          <p className="text-sm text-slate-500">Your opportunity pipeline. Drag cards between stages.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          + Study
        </button>
      </div>

      {/* Board tabs + controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                activeBoard?.id === b.id ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {b.name}
            </button>
          ))}
          <button onClick={addBoard} title="New board" className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100">
            +
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search opportunities"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setView('board')} className={`rounded-md px-3 py-1 text-sm ${view === 'board' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
            Board
          </button>
          <button onClick={() => setView('list')} className={`rounded-md px-3 py-1 text-sm ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
            List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading pipeline…</div>
      ) : view === 'board' ? (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const items = filtered.filter((o) => o.stage === stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                onDrop={() => handleDrop(stage)}
                className={`flex w-64 shrink-0 flex-col rounded-xl border-t-2 bg-slate-100/70 ${
                  STAGE_ACCENT[stage] || 'border-t-slate-300'
                } ${dragOver === stage ? 'ring-2 ring-primary-400' : ''}`}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{items.length}</span>
                </div>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {items.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={() => setDragId(o.id)}
                      onDragEnd={() => setDragId(null)}
                      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                    >
                      <div className="mb-1 line-clamp-2 text-xs font-semibold text-slate-800">{o.title}</div>
                      {o.sponsor && <div className="text-[11px] text-slate-500">{o.sponsor}</div>}
                      {o.pi && <div className="text-[11px] text-slate-400">PI: {o.pi}</div>}
                      {o.indications.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {o.indications.slice(0, 2).map((ind) => (
                            <span key={ind} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              {ind}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        {o.nctId && <span className="font-mono text-[10px] text-slate-400">{o.nctId}</span>}
                        <button
                          onClick={() => remove(o.id)}
                          className="ml-auto text-[11px] text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            onClick={addStage}
            className="h-10 w-40 shrink-0 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:border-slate-400 hover:text-slate-600"
          >
            + Add stage
          </button>
        </div>
      ) : (
        /* List view */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Study</th>
                <th className="px-3 py-2">Sponsor</th>
                <th className="px-3 py-2">PI</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{o.title}</td>
                  <td className="px-3 py-2 text-slate-600">{o.sponsor || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{o.pi || '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={o.stage}
                      onChange={(e) => move(o.id, e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {stages.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(o.id)} className="text-xs text-slate-400 hover:text-red-500">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-10 text-center text-sm text-slate-500">No opportunities.</div>}
        </div>
      )}

      {!loading && opps.length === 0 && view === 'board' && (
        <p className="mt-4 text-center text-sm text-slate-400">
          No opportunities on this board yet — click &ldquo;+ Study&rdquo; or push a study from Discover.
        </p>
      )}

      {showAdd && activeBoard && (
        <AddStudyModal
          board={activeBoard}
          onClose={() => setShowAdd(false)}
          onAdded={(opp) => {
            setShowAdd(false);
            if (opp.board === activeBoard.name) setOpps((prev) => [opp, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function AddStudyModal({
  board,
  onClose,
  onAdded,
}: {
  board: Board;
  onClose: () => void;
  onAdded: (opp: PipelineOpportunity) => void;
}) {
  const [title, setTitle] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [pi, setPi] = useState('');
  const [cro, setCro] = useState('');
  const [indications, setIndications] = useState('');
  const [stage, setStage] = useState(board.stages[0]);
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const opp = await pushToPipeline({
        title: title.trim(),
        sponsor: sponsor.trim() || undefined,
        pi: pi.trim() || undefined,
        cro: cro.trim() || undefined,
        indications: indications
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        stage,
        board: board.name,
        assignee: assignee.trim() || undefined,
        source: 'Manual',
      });
      onAdded(opp);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-slate-900">Add Opportunity</h3>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Study title *" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Sponsor" className={inputCls} />
            <input value={pi} onChange={(e) => setPi(e.target.value)} placeholder="PI" className={inputCls} />
            <input value={cro} onChange={(e) => setCro(e.target.value)} placeholder="CRO" className={inputCls} />
            <AssigneeSelect value={assignee} onChange={setAssignee} className={inputCls} />
          </div>
          <input value={indications} onChange={(e) => setIndications(e.target.value)} placeholder="Indications (comma-separated)" className={inputCls} />
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls}>
            {board.stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
