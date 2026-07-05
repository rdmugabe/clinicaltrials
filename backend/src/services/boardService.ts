import { randomUUID } from 'crypto';
import { db } from '../db/database.js';

export interface Board {
  id: string;
  name: string;
  stages: string[];
  position: number;
  createdAt: string;
}

interface BoardRow {
  id: string;
  name: string;
  stages: string;
  position: number;
  created_at: string;
}

function rowToBoard(r: BoardRow): Board {
  return { id: r.id, name: r.name, stages: JSON.parse(r.stages), position: r.position, createdAt: r.created_at };
}

export const boardService = {
  list(): Board[] {
    const rows = db.prepare('SELECT * FROM boards ORDER BY position, created_at').all() as BoardRow[];
    return rows.map(rowToBoard);
  },

  get(id: string): Board | undefined {
    const row = db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow | undefined;
    return row ? rowToBoard(row) : undefined;
  },

  create(name: string, stages?: string[]): Board {
    const id = `board_${randomUUID()}`;
    const now = new Date().toISOString();
    const pos = (db.prepare('SELECT COUNT(*) AS n FROM boards').get() as { n: number }).n;
    db.prepare('INSERT INTO boards (id, name, stages, position, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      name.trim(),
      JSON.stringify(stages && stages.length ? stages : ['Lead Only', 'Contacted', 'Awarded', 'Lost']),
      pos,
      now
    );
    return this.get(id)!;
  },

  /** Update a board's name and/or stage list. */
  update(id: string, input: { name?: string; stages?: string[] }): Board | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    db.prepare('UPDATE boards SET name = ?, stages = ? WHERE id = ?').run(
      input.name?.trim() ?? existing.name,
      JSON.stringify(input.stages ?? existing.stages),
      id
    );
    return this.get(id);
  },

  delete(id: string): boolean {
    return db.prepare('DELETE FROM boards WHERE id = ?').run(id).changes > 0;
  },
};
