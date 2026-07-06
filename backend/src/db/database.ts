import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

// Store the SQLite file under backend/data (gitignored). The backend dev/start
// scripts run with cwd = the backend workspace root.
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'studyfinder.db');

export const db: Database.Database = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Create all tables. Uses IF NOT EXISTS so this is safe to run on every boot.
 * Everything StudyFinder persists lives here.
 */
export function initDb(): void {
  db.exec(`
    -- Scouts (saved, indication-based search agents). The original app called
    -- these "saved searches"; StudyFinder promotes them to Scouts with extra
    -- metadata while staying backward compatible.
    CREATE TABLE IF NOT EXISTS scouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      params TEXT NOT NULL,             -- JSON SearchParams
      indication TEXT,
      color TEXT,
      shared INTEGER NOT NULL DEFAULT 0,
      weekly_report INTEGER NOT NULL DEFAULT 1,
      seen_nct_ids TEXT NOT NULL DEFAULT '[]', -- JSON array, for weekly report diffing
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Bookmarked studies (the "Bookmarks" feed tab).
    CREATE TABLE IF NOT EXISTS bookmarks (
      nct_id TEXT PRIMARY KEY,
      study TEXT,                       -- JSON snapshot of the study card data
      added_at TEXT NOT NULL
    );

    -- Hidden studies (excluded from the feed unless "show hidden" is on).
    CREATE TABLE IF NOT EXISTS hidden_studies (
      nct_id TEXT PRIMARY KEY,
      added_at TEXT NOT NULL
    );

    -- Feed items: a local ledger of when a study first entered the feed and
    -- from which source. Populated by the sync job (registry + news).
    CREATE TABLE IF NOT EXISTS feed_items (
      nct_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,             -- 'ClinicalTrials.gov' | 'News' | ...
      source_url TEXT,
      date_added TEXT NOT NULL,
      study TEXT                        -- JSON snapshot
    );

    -- Opportunities pushed into the TrialTrack pipeline.
    CREATE TABLE IF NOT EXISTS pipeline_opportunities (
      id TEXT PRIMARY KEY,
      nct_id TEXT,
      title TEXT NOT NULL,
      sponsor TEXT,
      indications TEXT,                 -- JSON array
      cro TEXT,
      pi TEXT,
      stage TEXT NOT NULL DEFAULT 'Lead Only',
      board TEXT NOT NULL DEFAULT 'Opportunities',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Contacts surfaced by contact discovery + enrichment.
    CREATE TABLE IF NOT EXISTS discovered_contacts (
      id TEXT PRIMARY KEY,
      nct_id TEXT,
      company TEXT,
      name TEXT NOT NULL,
      job_title TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'Not Contacted',
      email TEXT,
      linkedin TEXT,
      enriched INTEGER NOT NULL DEFAULT 0,
      enrichment_confidence TEXT,       -- 'verified' | 'guessed' | null
      source TEXT,
      created_at TEXT NOT NULL
    );

    -- Weekly reports produced by scouts.
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id TEXT PRIMARY KEY,
      scout_id TEXT NOT NULL,
      scout_name TEXT,
      week_of TEXT NOT NULL,
      nct_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
      study_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- TrialTrack boards: each board owns an ordered list of pipeline stages.
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stages TEXT NOT NULL,             -- JSON string[] of stage names
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- TrialTrack tasks.
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo', -- 'todo' | 'in_progress' | 'completed'
      assignee TEXT,
      category TEXT,
      opportunity_id TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- CRM companies (saved sponsors/CROs/biotech firms).
    CREATE TABLE IF NOT EXISTS crm_companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,                        -- 'Sponsor' | 'CRO' | 'Biotech' | ...
      hq TEXT,
      website TEXT,
      employees TEXT,
      founded TEXT,
      created_at TEXT NOT NULL
    );

    -- Email Sequences: multi-step outbound campaigns.
    CREATE TABLE IF NOT EXISTS sequences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'paused'
      steps TEXT NOT NULL DEFAULT '[]',      -- JSON [{subject, body, delayDays}]
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- A contact enrolled into a sequence, tracking its progress.
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id TEXT PRIMARY KEY,
      sequence_id TEXT NOT NULL,
      contact_id TEXT,
      contact_name TEXT,
      contact_email TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'stopped'
      enrolled_at TEXT NOT NULL,
      next_send_at TEXT,
      updated_at TEXT NOT NULL
    );

    -- One row per email actually sent (or simulated) for a sequence step.
    CREATE TABLE IF NOT EXISTS sequence_sends (
      id TEXT PRIMARY KEY,
      sequence_id TEXT NOT NULL,
      enrollment_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      subject TEXT,
      to_email TEXT,
      status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'opened' | 'replied' | 'bounced'
      created_at TEXT NOT NULL
    );

    -- Reusable email signatures.
    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Single-row connected mailbox config.
    CREATE TABLE IF NOT EXISTS mailbox (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      connected INTEGER NOT NULL DEFAULT 0,
      from_email TEXT,
      from_name TEXT,
      provider TEXT
    );

    -- Single-row account: plan/tier + credit metering for the top-bar counter.
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'My Research Site',
      plan TEXT NOT NULL DEFAULT 'Starter',
      tier TEXT NOT NULL DEFAULT 'starter',
      credits_used INTEGER NOT NULL DEFAULT 0,
      credits_total INTEGER NOT NULL DEFAULT 500
    );

    -- Shared team notes attached to any entity (study nctId or contact id).
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,   -- 'study' | 'contact'
      entity_id TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT,
      created_at TEXT NOT NULL
    );

    -- Cached full sponsor index built by sweeping the whole registry.
    CREATE TABLE IF NOT EXISTS sponsors (
      name_key TEXT PRIMARY KEY,   -- lowercased name
      name TEXT NOT NULL,
      class TEXT,
      study_count INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT
    );

    -- Email opt-out list (CAN-SPAM). No suppressed address is ever emailed.
    CREATE TABLE IF NOT EXISTS email_suppressions (
      email TEXT PRIMARY KEY,   -- lowercased
      reason TEXT,
      created_at TEXT NOT NULL
    );

    -- Progress/status for the sponsor-index sweep (single row).
    CREATE TABLE IF NOT EXISTS sponsor_sync (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL DEFAULT 'idle',  -- idle | running | done | error
      scanned INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      unique_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      finished_at TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_feed_items_date ON feed_items(date_added);
    CREATE INDEX IF NOT EXISTS idx_contacts_nct ON discovered_contacts(nct_id);
    CREATE INDEX IF NOT EXISTS idx_reports_scout ON weekly_reports(scout_id);
    CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sponsors_count ON sponsors(study_count DESC);
  `);

  // Seed the account + mailbox + sponsor-sync rows once.
  db.prepare(`INSERT INTO account (id) VALUES (1) ON CONFLICT(id) DO NOTHING`).run();
  db.prepare(`INSERT INTO mailbox (id) VALUES (1) ON CONFLICT(id) DO NOTHING`).run();
  db.prepare(`INSERT INTO sponsor_sync (id) VALUES (1) ON CONFLICT(id) DO NOTHING`).run();

  // Migration: add assignee/source to opportunities if the table predates them.
  const oppCols = (db.prepare(`PRAGMA table_info(pipeline_opportunities)`).all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!oppCols.includes('assignee')) {
    db.exec(`ALTER TABLE pipeline_opportunities ADD COLUMN assignee TEXT`);
  }
  if (!oppCols.includes('source')) {
    db.exec(`ALTER TABLE pipeline_opportunities ADD COLUMN source TEXT`);
  }

  // Migration: add wizard criteria + cached registry match total to scouts.
  const scoutCols = (db.prepare(`PRAGMA table_info(scouts)`).all() as { name: string }[]).map((c) => c.name);
  if (!scoutCols.includes('criteria')) {
    db.exec(`ALTER TABLE scouts ADD COLUMN criteria TEXT`);
  }
  if (!scoutCols.includes('match_total')) {
    db.exec(`ALTER TABLE scouts ADD COLUMN match_total INTEGER`);
  }

  // Seed default boards once.
  const boardCount = (db.prepare(`SELECT COUNT(*) AS n FROM boards`).get() as { n: number }).n;
  if (boardCount === 0) {
    const now = new Date().toISOString();
    const defaultStages = JSON.stringify([
      'Lead Only',
      'Intro Sent to PI',
      'Sponsor Contacted',
      'FQ Received',
      'FQ Returned',
      'PSV',
      'Awarded',
      'Lost',
    ]);
    const startupStages = JSON.stringify(['Site Selected', 'Contracts', 'Regulatory', 'SIV', 'Active']);
    const insert = db.prepare(
      `INSERT INTO boards (id, name, stages, position, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    insert.run('board_opportunities', 'Opportunities', defaultStages, 0, now);
    insert.run('board_startup', 'Start-Up', startupStages, 1, now);
  }
}

initDb();
