import { randomUUID } from 'crypto';
import { db } from '../db/database.js';
import { clinicalTrialsService } from './clinicalTrialsService.js';
import type { SearchParams } from '../types/clinicalTrials.js';
import type { Scout, WeeklyReport, ScoutCriteria } from '../types/studyfinder.js';

interface ScoutRow {
  id: string;
  name: string;
  params: string;
  criteria: string | null;
  indication: string | null;
  color: string | null;
  shared: number;
  weekly_report: number;
  seen_nct_ids: string;
  match_total: number | null;
  created_at: string;
  updated_at: string;
}

function rowToScout(r: ScoutRow): Scout {
  const seen = JSON.parse(r.seen_nct_ids) as string[];
  return {
    id: r.id,
    name: r.name,
    params: JSON.parse(r.params) as SearchParams,
    criteria: r.criteria ? (JSON.parse(r.criteria) as ScoutCriteria) : undefined,
    indication: r.indication || undefined,
    color: r.color || undefined,
    shared: !!r.shared,
    weeklyReport: !!r.weekly_report,
    seenNctIds: seen,
    matchCount: seen.length,
    matchTotal: r.match_total ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Translate the wizard's structured criteria into a ClinicalTrials.gov query.
 * Conditions and keywords become Essie OR expressions; exclude keywords become
 * a NOT clause; multiple locations are OR'd; phases map straight through.
 */
function criteriaToParams(criteria: ScoutCriteria): SearchParams {
  const params: SearchParams = {};
  const quote = (s: string) => `"${s.replace(/"/g, '')}"`;

  if (criteria.conditions.length > 0) {
    params.condition = criteria.conditions.map((c) => quote(c.label)).join(' OR ');
  }

  const termParts: string[] = [];
  if (criteria.keywords.length > 0) {
    termParts.push(`(${criteria.keywords.map(quote).join(' OR ')})`);
  }
  if (criteria.excludeKeywords.length > 0) {
    termParts.push(`NOT (${criteria.excludeKeywords.map(quote).join(' OR ')})`);
  }
  if (termParts.length > 0) params.term = termParts.join(' ');

  if (criteria.locations.length > 0) params.location = criteria.locations.join(' OR ');
  if (criteria.phases.length > 0) params.phase = criteria.phases;

  return params;
}

/** Pick a human-friendly indication label from the chosen criteria. */
function deriveIndication(criteria?: ScoutCriteria): string | undefined {
  if (!criteria) return undefined;
  if (criteria.conditions.length > 0) {
    const areas = Array.from(new Set(criteria.conditions.map((c) => c.areaName)));
    return areas.length === 1 ? areas[0] : `${areas[0]} +${areas.length - 1} more`;
  }
  if (criteria.keywords.length > 0) return criteria.keywords[0];
  if (criteria.locations.length > 0) return criteria.locations.join(', ');
  return undefined;
}

export const scoutService = {
  list(): Scout[] {
    const rows = db.prepare('SELECT * FROM scouts ORDER BY updated_at DESC').all() as ScoutRow[];
    return rows.map(rowToScout);
  },

  get(id: string): Scout | undefined {
    const row = db.prepare('SELECT * FROM scouts WHERE id = ?').get(id) as ScoutRow | undefined;
    return row ? rowToScout(row) : undefined;
  },

  create(input: {
    name: string;
    params?: SearchParams;
    criteria?: ScoutCriteria;
    indication?: string;
    color?: string;
    weeklyReport?: boolean;
  }): Scout {
    const id = `scout_${randomUUID()}`;
    const now = new Date().toISOString();
    // When wizard criteria are provided, derive the registry query from them.
    const params = input.criteria ? criteriaToParams(input.criteria) : input.params || {};
    const indication = input.indication || deriveIndication(input.criteria) || null;
    db.prepare(
      `INSERT INTO scouts (id, name, params, criteria, indication, color, shared, weekly_report, seen_nct_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, '[]', ?, ?)`
    ).run(
      id,
      input.name.trim(),
      JSON.stringify(params),
      input.criteria ? JSON.stringify(input.criteria) : null,
      indication,
      input.color || null,
      input.weeklyReport === false ? 0 : 1,
      now,
      now
    );
    return this.get(id)!;
  },

  update(
    id: string,
    input: Partial<{
      name: string;
      params: SearchParams;
      criteria: ScoutCriteria;
      indication: string;
      color: string;
      shared: boolean;
      weeklyReport: boolean;
    }>
  ): Scout | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    // If new criteria are supplied, re-derive params + indication from them.
    const criteria = input.criteria ?? existing.criteria;
    const params = input.criteria ? criteriaToParams(input.criteria) : input.params ?? existing.params;
    const indication =
      input.indication ?? (input.criteria ? deriveIndication(input.criteria) : existing.indication) ?? null;
    db.prepare(
      `UPDATE scouts SET name = ?, params = ?, criteria = ?, indication = ?, color = ?, shared = ?, weekly_report = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.name?.trim() ?? existing.name,
      JSON.stringify(params),
      criteria ? JSON.stringify(criteria) : null,
      indication,
      input.color ?? existing.color ?? null,
      (input.shared ?? existing.shared) ? 1 : 0,
      (input.weeklyReport ?? existing.weeklyReport) ? 1 : 0,
      now,
      id
    );
    return this.get(id);
  },

  delete(id: string): boolean {
    const info = db.prepare('DELETE FROM scouts WHERE id = ?').run(id);
    db.prepare('DELETE FROM weekly_reports WHERE scout_id = ?').run(id);
    return info.changes > 0;
  },

  /** Cache the true # of studies matching this scout's query in the registry. */
  setMatchTotal(id: string, total: number): void {
    db.prepare('UPDATE scouts SET match_total = ? WHERE id = ?').run(total, id);
  },

  /**
   * Run a scout against the registry and generate a weekly report of the new
   * matching studies (those not previously seen). Updates the scout's seen set.
   */
  async generateWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
    const scout = this.get(id);
    if (!scout) return undefined;

    const res = await clinicalTrialsService.searchStudies({
      ...scout.params,
      sort: 'LastUpdatePostDate',
      sortOrder: 'desc',
      pageSize: 50,
    });

    // Cache the true match total surfaced by this run.
    this.setMatchTotal(id, res.totalCount);

    const seen = new Set(scout.seenNctIds);
    const fresh = res.studies
      .map((s) => s.protocolSection.identificationModule.nctId)
      .filter((nctId) => !seen.has(nctId));

    const now = new Date();
    const report: WeeklyReport = {
      id: `report_${randomUUID()}`,
      scoutId: id,
      scoutName: scout.name,
      weekOf: now.toISOString().slice(0, 10),
      nctIds: fresh,
      studyCount: fresh.length,
      createdAt: now.toISOString(),
    };

    // Only record a report (and update the seen set) when the run actually
    // surfaced new studies — empty runs are not logged.
    if (fresh.length > 0) {
      db.prepare(
        `INSERT INTO weekly_reports (id, scout_id, scout_name, week_of, nct_ids, study_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(report.id, id, scout.name, report.weekOf, JSON.stringify(fresh), fresh.length, report.createdAt);

      for (const nctId of fresh) seen.add(nctId);
      db.prepare('UPDATE scouts SET seen_nct_ids = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(Array.from(seen)),
        now.toISOString(),
        id
      );
    }

    return report;
  },

  listReports(scoutId?: string): WeeklyReport[] {
    const rows = (
      scoutId
        ? db.prepare('SELECT * FROM weekly_reports WHERE scout_id = ? ORDER BY created_at DESC').all(scoutId)
        : db.prepare('SELECT * FROM weekly_reports ORDER BY created_at DESC').all()
    ) as {
      id: string;
      scout_id: string;
      scout_name: string | null;
      week_of: string;
      nct_ids: string;
      study_count: number;
      created_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      scoutId: r.scout_id,
      scoutName: r.scout_name || undefined,
      weekOf: r.week_of,
      nctIds: JSON.parse(r.nct_ids) as string[],
      studyCount: r.study_count,
      createdAt: r.created_at,
    }));
  },
};
