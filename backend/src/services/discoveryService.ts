import { randomUUID } from 'crypto';
import { db } from '../db/database.js';
import { clinicalTrialsService } from './clinicalTrialsService.js';
import { enrichmentService } from './enrichmentService.js';
import type { DiscoveredContact } from '../types/studyfinder.js';

interface ContactRow {
  id: string;
  nct_id: string | null;
  company: string | null;
  name: string;
  job_title: string | null;
  location: string | null;
  status: string;
  email: string | null;
  linkedin: string | null;
  enriched: number;
  enrichment_confidence: string | null;
  source: string | null;
  created_at: string;
}

function rowToContact(r: ContactRow): DiscoveredContact {
  return {
    id: r.id,
    nctId: r.nct_id || undefined,
    company: r.company || undefined,
    name: r.name,
    jobTitle: r.job_title || undefined,
    location: r.location || undefined,
    status: r.status,
    email: r.email || undefined,
    linkedin: r.linkedin || undefined,
    enriched: !!r.enriched,
    enrichmentConfidence: (r.enrichment_confidence as 'verified' | 'guessed') || undefined,
    source: r.source || undefined,
    createdAt: r.created_at,
  };
}

interface RawPerson {
  name: string;
  jobTitle?: string;
  location?: string;
  email?: string;
  source: string;
}

/** Identity used to dedupe contacts: same person at the same company. */
function contactKey(name: string, company?: string | null): string {
  return `${name.trim().toLowerCase()}||${(company || '').trim().toLowerCase()}`;
}

export const discoveryService = {
  /**
   * Extract the real people attached to a study record on ClinicalTrials.gov
   * (overall officials, central contacts, site contacts) and persist them as
   * discovered contacts. Idempotent: re-running won't create duplicates.
   */
  async discoverForStudy(nctId: string): Promise<DiscoveredContact[]> {
    const study = await clinicalTrialsService.getStudyById(nctId);
    const p = study.protocolSection;
    const company = p.sponsorCollaboratorsModule?.leadSponsor?.name;
    const contactsModule = p.contactsLocationsModule;

    const people: RawPerson[] = [];

    for (const off of contactsModule?.overallOfficials || []) {
      if (!off.name) continue;
      people.push({
        name: off.name,
        jobTitle: off.role,
        location: off.affiliation,
        source: 'Overall Official',
      });
    }
    for (const c of contactsModule?.centralContacts || []) {
      if (!c.name) continue;
      people.push({
        name: c.name,
        jobTitle: c.role || 'Central Contact',
        email: c.email,
        source: 'Central Contact',
      });
    }
    for (const loc of contactsModule?.locations || []) {
      for (const c of loc.contacts || []) {
        if (!c.name) continue;
        people.push({
          name: c.name,
          jobTitle: c.role || 'Site Contact',
          location: [loc.city, loc.country].filter(Boolean).join(', ') || loc.facility,
          email: c.email,
          source: 'Site Staff',
        });
      }
    }

    const now = new Date().toISOString();
    // Dedupe globally by person + company (not just within this study), and
    // track keys we insert during this run so a name repeated across the
    // study's own contact list isn't added more than once.
    const existing = db
      .prepare('SELECT name, company FROM discovered_contacts')
      .all() as { name: string; company: string | null }[];
    const seen = new Set(existing.map((e) => contactKey(e.name, e.company)));

    const insert = db.prepare(
      `INSERT INTO discovered_contacts
        (id, nct_id, company, name, job_title, location, status, email, linkedin, enriched, enrichment_confidence, source, created_at)
       VALUES (@id, @nct_id, @company, @name, @job_title, @location, @status, @email, @linkedin, @enriched, @enrichment_confidence, @source, @created_at)`
    );
    const tx = db.transaction((rows: RawPerson[]) => {
      for (const person of rows) {
        const key = contactKey(person.name, company);
        if (seen.has(key)) continue;
        seen.add(key);
        insert.run({
          id: randomUUID(),
          nct_id: nctId,
          company: company || null,
          name: person.name,
          job_title: person.jobTitle || null,
          location: person.location || null,
          status: 'Not Contacted',
          email: person.email || null,
          linkedin: null,
          enriched: person.email ? 1 : 0,
          enrichment_confidence: person.email ? 'verified' : null,
          source: person.source,
          created_at: now,
        });
      }
    });
    tx(people);

    return this.listContacts(nctId);
  },

  get(id: string): DiscoveredContact | undefined {
    const row = db.prepare('SELECT * FROM discovered_contacts WHERE id = ?').get(id) as ContactRow | undefined;
    return row ? rowToContact(row) : undefined;
  },

  listContacts(nctId?: string): DiscoveredContact[] {
    const rows = (
      nctId
        ? db.prepare('SELECT * FROM discovered_contacts WHERE nct_id = ? ORDER BY created_at').all(nctId)
        : db.prepare('SELECT * FROM discovered_contacts ORDER BY created_at DESC').all()
    ) as ContactRow[];
    return rows.map(rowToContact);
  },

  async enrichContact(id: string): Promise<DiscoveredContact> {
    const row = db.prepare('SELECT * FROM discovered_contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;
    if (!row) throw new Error('Contact not found');

    const result = await enrichmentService.enrich(row.name, row.company || undefined);

    // Never downgrade a verified email (e.g. one that came straight from the
    // registry) with a lower-confidence guess. Only replace the email when we
    // have none yet, or when the new result is verified.
    const hadVerifiedEmail = !!row.email && row.enrichment_confidence === 'verified';
    const keepExistingEmail = hadVerifiedEmail && result.confidence !== 'verified';
    const newEmail = keepExistingEmail ? row.email : result.email || row.email;
    const newConfidence = keepExistingEmail ? row.enrichment_confidence : result.confidence;

    db.prepare(
      `UPDATE discovered_contacts
       SET email = ?,
           linkedin = COALESCE(?, linkedin),
           enriched = 1,
           enrichment_confidence = ?
       WHERE id = ?`
    ).run(newEmail || null, result.linkedin || null, newConfidence, id);

    return rowToContact(db.prepare('SELECT * FROM discovered_contacts WHERE id = ?').get(id) as ContactRow);
  },

  setStatus(ids: string[], status: string): void {
    const update = db.prepare('UPDATE discovered_contacts SET status = ? WHERE id = ?');
    const tx = db.transaction((rows: string[]) => {
      for (const id of rows) update.run(status, id);
    });
    tx(ids);
  },
};
