'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/api';
import AssigneeSelect from '@/components/AssigneeSelect';
import type { Task, TaskStatus } from '@/types';

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: 'todo', label: 'To Do', accent: 'border-t-slate-300' },
  { key: 'in_progress', label: 'In Progress', accent: 'border-t-primary-400' },
  { key: 'completed', label: 'Completed', accent: 'border-t-emerald-400' },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Form
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTasks();
      setTasks(res.tasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignees = useMemo(() => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))) as string[], [tasks]);
  const categories = useMemo(() => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))) as string[], [tasks]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (assigneeFilter && t.assignee !== assigneeFilter) return false;
        if (categoryFilter && t.category !== categoryFilter) return false;
        return true;
      }),
    [tasks, assigneeFilter, categoryFilter]
  );

  const move = async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await updateTask(id, { status });
  };

  const handleDrop = (status: TaskStatus) => {
    if (dragId) move(dragId, status);
    setDragId(null);
    setDragOver(null);
  };

  const remove = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTask(id);
  };

  const submit = async () => {
    if (!title.trim()) return;
    const task = await createTask({
      title: title.trim(),
      assignee: assignee.trim() || undefined,
      category: category.trim() || undefined,
    });
    setTasks((prev) => [task, ...prev]);
    setTitle('');
    setAssignee('');
    setCategory('');
    setShowForm(false);
  };

  const selectCls = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm';

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">Track BD tasks across your team.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          + Task
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AssigneeSelect
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          mode="filter"
          extraOptions={assignees}
          className={selectCls}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectCls}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading tasks…</div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = filtered.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() => setDragOver((s) => (s === col.key ? null : s))}
                onDrop={() => handleDrop(col.key)}
                className={`flex flex-col rounded-xl border-t-2 bg-slate-100/70 ${col.accent} ${
                  dragOver === col.key ? 'ring-2 ring-primary-400' : ''
                }`}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{items.length}</span>
                </div>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                    >
                      <div className="text-sm font-medium text-slate-800">{t.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {t.category && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{t.category}</span>}
                        {t.assignee && (
                          <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
                            {t.assignee}
                          </span>
                        )}
                        <button
                          onClick={() => remove(t.id)}
                          className="ml-auto text-[11px] text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="px-2 py-6 text-center text-xs text-slate-400">No tasks</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-slate-900">New Task</h3>
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <AssigneeSelect value={assignee} onChange={setAssignee} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={submit} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
