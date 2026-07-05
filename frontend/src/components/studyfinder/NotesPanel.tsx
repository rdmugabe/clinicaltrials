'use client';

import { useEffect, useState } from 'react';
import { getNotes, addNote, deleteNote } from '@/lib/api';
import type { Note, NoteEntityType } from '@/types';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Shared team notes for any entity (study nctId or contact id). Notes are stored
 * server-side, so everyone on the team sees the same running list.
 */
export default function NotesPanel({
  entityType,
  entityId,
  onCountChange,
}: {
  entityType: NoteEntityType;
  entityId: string;
  onCountChange?: (n: number) => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getNotes(entityType, entityId)
      .then((d) => {
        if (!alive) return;
        setNotes(d.notes);
        onCountChange?.(d.notes.length);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const submit = async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const { note } = await addNote({ entityType, entityId, body: text });
      setNotes((prev) => {
        const next = [note, ...prev];
        onCountChange?.(next.length);
        return next;
      });
      setBody('');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      onCountChange?.(next.length);
      return next;
    });
    await deleteNote(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">Team notes</span>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
          Shared with everyone
        </span>
      </div>

      {/* Composer */}
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Add a note for your team — contact info, context, next steps…"
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">⌘/Ctrl + Enter to save</span>
          <button
            onClick={submit}
            disabled={!body.trim() || saving}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate-400">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet. Add the first one above.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-slate-200 bg-white p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="font-medium text-slate-500">{n.author || 'Team member'}</span>
                <span>· {timeAgo(n.createdAt)}</span>
                <button
                  onClick={() => remove(n.id)}
                  className="ml-auto text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  aria-label="Delete note"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
