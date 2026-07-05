import { db } from '../db/database.js';

export interface ReportFilters {
  board?: string;
  stage?: string;
  assignee?: string;
  source?: string;
  pi?: string;
  indication?: string;
}

export interface ReportSummary {
  totalOpportunities: number;
  avgTimeToCloseDays: number | null;
  closeRatePct: number | null;
  totalCompanies: number;
  totalContacts: number;
  byStage: { stage: string; count: number }[];
  bySource: { source: string; count: number }[];
}

interface OppRow {
  stage: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

function buildWhere(f: ReportFilters): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (f.board) {
    clauses.push('board = ?');
    params.push(f.board);
  }
  if (f.stage) {
    clauses.push('stage = ?');
    params.push(f.stage);
  }
  if (f.assignee) {
    clauses.push('assignee = ?');
    params.push(f.assignee);
  }
  if (f.source) {
    clauses.push('source = ?');
    params.push(f.source);
  }
  if (f.pi) {
    clauses.push('pi = ?');
    params.push(f.pi);
  }
  if (f.indication) {
    clauses.push('indications LIKE ?');
    params.push(`%${f.indication}%`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export const reportService = {
  summary(filters: ReportFilters = {}): ReportSummary {
    const { where, params } = buildWhere(filters);
    const opps = db
      .prepare(`SELECT stage, source, created_at, updated_at FROM pipeline_opportunities ${where}`)
      .all(...params) as OppRow[];

    const total = opps.length;

    // Won / lost detection by stage name.
    const isWon = (s: string) => /awarded|won/i.test(s);
    const isLost = (s: string) => /lost/i.test(s);
    const won = opps.filter((o) => isWon(o.stage));
    const lost = opps.filter((o) => isLost(o.stage));
    const closedCount = won.length + lost.length;
    const closeRatePct = closedCount > 0 ? Math.round((won.length / closedCount) * 100) : null;

    // Average time to close (days) across won+lost opps.
    const closed = [...won, ...lost];
    let avgTimeToCloseDays: number | null = null;
    if (closed.length > 0) {
      const totalDays = closed.reduce((sum, o) => {
        const ms = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
        return sum + Math.max(0, ms) / (1000 * 60 * 60 * 24);
      }, 0);
      avgTimeToCloseDays = Math.round((totalDays / closed.length) * 10) / 10;
    }

    // Group counts.
    const stageMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();
    for (const o of opps) {
      stageMap.set(o.stage, (stageMap.get(o.stage) || 0) + 1);
      const src = o.source || 'Unknown';
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    }

    const totalCompanies = (db.prepare('SELECT COUNT(*) AS n FROM crm_companies').get() as { n: number }).n;
    const totalContacts = (db.prepare('SELECT COUNT(*) AS n FROM discovered_contacts').get() as { n: number }).n;

    return {
      totalOpportunities: total,
      avgTimeToCloseDays,
      closeRatePct,
      totalCompanies,
      totalContacts,
      byStage: Array.from(stageMap, ([stage, count]) => ({ stage, count })),
      bySource: Array.from(sourceMap, ([source, count]) => ({ source, count })),
    };
  },

  /** Distinct filter values for the Reports UI dropdowns. */
  filterOptions() {
    const distinct = (col: string) =>
      (db.prepare(`SELECT DISTINCT ${col} AS v FROM pipeline_opportunities WHERE ${col} IS NOT NULL AND ${col} != ''`).all() as {
        v: string;
      }[]).map((r) => r.v);
    return {
      stages: distinct('stage'),
      assignees: distinct('assignee'),
      sources: distinct('source'),
      pis: distinct('pi'),
    };
  },
};
