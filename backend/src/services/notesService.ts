import { randomUUID } from 'crypto';
import { db } from '../db/database.js';

export type NoteEntityType = 'study' | 'contact';

export interface Note {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  body: string;
  author?: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  entity_type: string;
  entity_id: string;
  body: string;
  author: string | null;
  created_at: string;
}

function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    entityType: r.entity_type as NoteEntityType,
    entityId: r.entity_id,
    body: r.body,
    author: r.author || undefined,
    createdAt: r.created_at,
  };
}

export const notesService = {
  /** All notes for one entity, newest first. */
  list(entityType: NoteEntityType, entityId: string): Note[] {
    const rows = db
      .prepare('SELECT * FROM notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC')
      .all(entityType, entityId) as NoteRow[];
    return rows.map(rowToNote);
  },

  add(input: { entityType: NoteEntityType; entityId: string; body: string; author?: string }): Note {
    const id = `note_${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notes (id, entity_type, entity_id, body, author, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.entityType, input.entityId, input.body.trim(), input.author?.trim() || 'Team member', now);
    return rowToNote(db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow);
  },

  remove(id: string): boolean {
    return db.prepare('DELETE FROM notes WHERE id = ?').run(id).changes > 0;
  },

  /** Note counts for a set of entity ids (for list badges). */
  counts(entityType: NoteEntityType, ids: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT entity_id, COUNT(*) AS n FROM notes
         WHERE entity_type = ? AND entity_id IN (${placeholders})
         GROUP BY entity_id`
      )
      .all(entityType, ...ids) as { entity_id: string; n: number }[];
    for (const r of rows) out[r.entity_id] = r.n;
    return out;
  },
};
