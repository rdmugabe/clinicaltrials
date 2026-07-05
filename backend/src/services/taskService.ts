import { randomUUID } from 'crypto';
import { db } from '../db/database.js';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: string;
  category?: string;
  opportunityId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  category: string | null;
  opportunity_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description || undefined,
    status: r.status,
    assignee: r.assignee || undefined,
    category: r.category || undefined,
    opportunityId: r.opportunity_id || undefined,
    dueDate: r.due_date || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const taskService = {
  list(filters: { opportunityId?: string; category?: string; assignee?: string } = {}): Task[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.opportunityId) {
      clauses.push('opportunity_id = ?');
      params.push(filters.opportunityId);
    }
    if (filters.category) {
      clauses.push('category = ?');
      params.push(filters.category);
    }
    if (filters.assignee) {
      clauses.push('assignee = ?');
      params.push(filters.assignee);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`).all(...params) as TaskRow[];
    return rows.map(rowToTask);
  },

  create(input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    assignee?: string;
    category?: string;
    opportunityId?: string;
    dueDate?: string;
  }): Task {
    const id = `task_${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, title, description, status, assignee, category, opportunity_id, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.title.trim(),
      input.description || null,
      input.status || 'todo',
      input.assignee || null,
      input.category || null,
      input.opportunityId || null,
      input.dueDate || null,
      now,
      now
    );
    return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow);
  },

  update(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      assignee: string;
      category: string;
      dueDate: string;
    }>
  ): Task | undefined {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!existing) return undefined;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE tasks SET title = ?, description = ?, status = ?, assignee = ?, category = ?, due_date = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.title?.trim() ?? existing.title,
      input.description ?? existing.description,
      input.status ?? existing.status,
      input.assignee ?? existing.assignee,
      input.category ?? existing.category,
      input.dueDate ?? existing.due_date,
      now,
      id
    );
    return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow);
  },

  delete(id: string): boolean {
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
  },
};
