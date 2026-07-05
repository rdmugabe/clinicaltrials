import { randomUUID } from 'crypto';
import { db } from '../db/database.js';
import type { PipelineOpportunity } from '../types/studyfinder.js';

interface OppRow {
  id: string;
  nct_id: string | null;
  title: string;
  sponsor: string | null;
  indications: string | null;
  cro: string | null;
  pi: string | null;
  stage: string;
  board: string;
  assignee: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

function rowToOpp(r: OppRow): PipelineOpportunity {
  return {
    id: r.id,
    nctId: r.nct_id || undefined,
    title: r.title,
    sponsor: r.sponsor || undefined,
    indications: r.indications ? (JSON.parse(r.indications) as string[]) : [],
    cro: r.cro || undefined,
    pi: r.pi || undefined,
    stage: r.stage,
    board: r.board,
    assignee: r.assignee || undefined,
    source: r.source || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const pipelineService = {
  list(board?: string): PipelineOpportunity[] {
    const rows = (
      board
        ? db.prepare('SELECT * FROM pipeline_opportunities WHERE board = ? ORDER BY created_at DESC').all(board)
        : db.prepare('SELECT * FROM pipeline_opportunities ORDER BY created_at DESC').all()
    ) as OppRow[];
    return rows.map(rowToOpp);
  },

  /** Push a study from StudyFinder into the TrialTrack pipeline. */
  add(input: {
    nctId?: string;
    title: string;
    sponsor?: string;
    indications?: string[];
    cro?: string;
    pi?: string;
    stage?: string;
    board?: string;
    assignee?: string;
    source?: string;
  }): PipelineOpportunity {
    // Avoid duplicating an opportunity already in the pipeline for this study.
    if (input.nctId) {
      const existing = db
        .prepare('SELECT * FROM pipeline_opportunities WHERE nct_id = ?')
        .get(input.nctId) as OppRow | undefined;
      if (existing) return rowToOpp(existing);
    }

    const id = `opp_${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO pipeline_opportunities
        (id, nct_id, title, sponsor, indications, cro, pi, stage, board, assignee, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.nctId || null,
      input.title,
      input.sponsor || null,
      JSON.stringify(input.indications || []),
      input.cro || null,
      input.pi || null,
      input.stage || 'Lead Only',
      input.board || 'Opportunities',
      input.assignee || null,
      input.source || 'StudyFinder',
      now,
      now
    );
    return rowToOpp(db.prepare('SELECT * FROM pipeline_opportunities WHERE id = ?').get(id) as OppRow);
  },

  updateStage(id: string, stage: string): PipelineOpportunity | undefined {
    const info = db
      .prepare('UPDATE pipeline_opportunities SET stage = ?, updated_at = ? WHERE id = ?')
      .run(stage, new Date().toISOString(), id);
    if (info.changes === 0) return undefined;
    return rowToOpp(db.prepare('SELECT * FROM pipeline_opportunities WHERE id = ?').get(id) as OppRow);
  },

  delete(id: string): boolean {
    return db.prepare('DELETE FROM pipeline_opportunities WHERE id = ?').run(id).changes > 0;
  },
};
