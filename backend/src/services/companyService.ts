import { randomUUID } from 'crypto';
import { db } from '../db/database.js';

export interface CrmCompany {
  id: string;
  name: string;
  type?: string;
  hq?: string;
  website?: string;
  employees?: string;
  founded?: string;
  createdAt: string;
}

interface CompanyRow {
  id: string;
  name: string;
  type: string | null;
  hq: string | null;
  website: string | null;
  employees: string | null;
  founded: string | null;
  created_at: string;
}

function rowToCompany(r: CompanyRow): CrmCompany {
  return {
    id: r.id,
    name: r.name,
    type: r.type || undefined,
    hq: r.hq || undefined,
    website: r.website || undefined,
    employees: r.employees || undefined,
    founded: r.founded || undefined,
    createdAt: r.created_at,
  };
}

export const companyService = {
  list(): CrmCompany[] {
    const rows = db.prepare('SELECT * FROM crm_companies ORDER BY name').all() as CompanyRow[];
    return rows.map(rowToCompany);
  },

  create(input: { name: string; type?: string; hq?: string; website?: string; employees?: string; founded?: string }): CrmCompany {
    const id = `company_${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO crm_companies (id, name, type, hq, website, employees, founded, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name.trim(),
      input.type || null,
      input.hq || null,
      input.website || null,
      input.employees || null,
      input.founded || null,
      now
    );
    return rowToCompany(db.prepare('SELECT * FROM crm_companies WHERE id = ?').get(id) as CompanyRow);
  },

  delete(id: string): boolean {
    return db.prepare('DELETE FROM crm_companies WHERE id = ?').run(id).changes > 0;
  },

  /**
   * Seed the CRM companies list from the sponsors already present in the
   * pipeline — a one-click way to populate the directory from real activity.
   */
  importFromPipeline(): number {
    const sponsors = db
      .prepare(`SELECT DISTINCT sponsor FROM pipeline_opportunities WHERE sponsor IS NOT NULL AND sponsor != ''`)
      .all() as { sponsor: string }[];
    const existing = new Set(
      (db.prepare('SELECT name FROM crm_companies').all() as { name: string }[]).map((c) => c.name.toLowerCase())
    );
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO crm_companies (id, name, type, created_at) VALUES (?, ?, 'Sponsor', ?)`
    );
    let added = 0;
    const tx = db.transaction((rows: { sponsor: string }[]) => {
      for (const r of rows) {
        if (existing.has(r.sponsor.toLowerCase())) continue;
        insert.run(`company_${randomUUID()}`, r.sponsor, now);
        added++;
      }
    });
    tx(sponsors);
    return added;
  },
};
