import { randomUUID } from 'crypto';
import { db } from '../db/database.js';
import { emailService } from './emailService.js';
import { contactVars } from './personalize.js';
import type {
  Sequence,
  SequenceStep,
  SequenceEnrollment,
  Signature,
  Mailbox,
  SequenceMetrics,
} from '../types/studyfinder.js';

interface SeqRow {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  steps: string;
  created_at: string;
  updated_at: string;
}

function enrolledCount(sequenceId: string): number {
  return (
    db.prepare('SELECT COUNT(*) AS n FROM sequence_enrollments WHERE sequence_id = ?').get(sequenceId) as {
      n: number;
    }
  ).n;
}

/**
 * Keep a discovered contact's status honest: once they're no longer in any
 * active sequence, drop the "In Sequence" label to a neutral one.
 */
function syncContactStatus(contactId: string | null | undefined, neutral: string): void {
  if (!contactId) return;
  const active = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM sequence_enrollments WHERE contact_id = ? AND status = 'active'`)
      .get(contactId) as { n: number }
  ).n;
  if (active > 0) return; // still enrolled elsewhere — keep "In Sequence"
  const row = db.prepare('SELECT status FROM discovered_contacts WHERE id = ?').get(contactId) as
    | { status: string }
    | undefined;
  if (row && row.status === 'In Sequence') {
    db.prepare('UPDATE discovered_contacts SET status = ? WHERE id = ?').run(neutral, contactId);
  }
}

function rowToSeq(r: SeqRow): Sequence {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    steps: JSON.parse(r.steps) as SequenceStep[],
    enrolledCount: enrolledCount(r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export const sequenceService = {
  // ---------- Sequences ----------
  list(): Sequence[] {
    const rows = db.prepare('SELECT * FROM sequences ORDER BY updated_at DESC').all() as SeqRow[];
    return rows.map(rowToSeq);
  },

  get(id: string): Sequence | undefined {
    const row = db.prepare('SELECT * FROM sequences WHERE id = ?').get(id) as SeqRow | undefined;
    return row ? rowToSeq(row) : undefined;
  },

  create(input: { name: string; steps?: SequenceStep[] }): Sequence {
    const id = `seq_${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO sequences (id, name, status, steps, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?)`
    ).run(id, input.name.trim(), JSON.stringify(input.steps || []), now, now);
    return this.get(id)!;
  },

  update(id: string, input: { name?: string; steps?: SequenceStep[]; status?: Sequence['status'] }): Sequence | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    db.prepare('UPDATE sequences SET name = ?, steps = ?, status = ?, updated_at = ? WHERE id = ?').run(
      input.name?.trim() ?? existing.name,
      JSON.stringify(input.steps ?? existing.steps),
      input.status ?? existing.status,
      now,
      id
    );
    return this.get(id);
  },

  delete(id: string): boolean {
    db.prepare('DELETE FROM sequence_enrollments WHERE sequence_id = ?').run(id);
    db.prepare('DELETE FROM sequence_sends WHERE sequence_id = ?').run(id);
    return db.prepare('DELETE FROM sequences WHERE id = ?').run(id).changes > 0;
  },

  /** Flip a sequence active/paused. Activating makes due steps eligible to send. */
  async setStatus(id: string, status: 'active' | 'paused'): Promise<Sequence | undefined> {
    const seq = this.update(id, { status });
    if (seq && status === 'active') {
      // Make active enrollments with no scheduled send eligible immediately.
      db.prepare(
        `UPDATE sequence_enrollments SET next_send_at = ? WHERE sequence_id = ? AND status = 'active' AND next_send_at IS NULL`
      ).run(new Date().toISOString(), id);
      await this.processQueue();
    }
    return this.get(id);
  },

  // ---------- Enrollments ----------
  enroll(
    sequenceId: string,
    contacts: { contactId?: string; name?: string; email: string }[]
  ): { enrolled: number } {
    const seq = this.get(sequenceId);
    if (!seq) throw new Error('Sequence not found');
    const now = new Date().toISOString();
    const existing = new Set(
      (
        db.prepare('SELECT contact_email FROM sequence_enrollments WHERE sequence_id = ?').all(sequenceId) as {
          contact_email: string;
        }[]
      ).map((r) => r.contact_email.toLowerCase())
    );
    const insert = db.prepare(
      `INSERT INTO sequence_enrollments
        (id, sequence_id, contact_id, contact_name, contact_email, current_step, status, enrolled_at, next_send_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)`
    );
    let enrolled = 0;
    const nextSend = seq.status === 'active' ? now : null;
    const tx = db.transaction((list: typeof contacts) => {
      for (const c of list) {
        if (!c.email || existing.has(c.email.toLowerCase())) continue;
        insert.run(`enr_${randomUUID()}`, sequenceId, c.contactId || null, c.name || null, c.email, now, nextSend, now);
        enrolled++;
      }
    });
    tx(contacts);
    return { enrolled };
  },

  listEnrollments(sequenceId: string): SequenceEnrollment[] {
    const rows = db
      .prepare('SELECT * FROM sequence_enrollments WHERE sequence_id = ? ORDER BY enrolled_at DESC')
      .all(sequenceId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      sequenceId: r.sequence_id as string,
      contactId: (r.contact_id as string) || undefined,
      contactName: (r.contact_name as string) || undefined,
      contactEmail: r.contact_email as string,
      currentStep: r.current_step as number,
      status: r.status as SequenceEnrollment['status'],
      enrolledAt: r.enrolled_at as string,
      nextSendAt: (r.next_send_at as string) || undefined,
    }));
  },

  /** Stop an active enrollment (no more sends) and drop the contact's label. */
  stopEnrollment(enrollmentId: string): boolean {
    const row = db.prepare('SELECT contact_id, status FROM sequence_enrollments WHERE id = ?').get(enrollmentId) as
      | { contact_id: string | null; status: string }
      | undefined;
    if (!row) return false;
    db.prepare(
      `UPDATE sequence_enrollments SET status = 'stopped', next_send_at = NULL, updated_at = ? WHERE id = ?`
    ).run(new Date().toISOString(), enrollmentId);
    syncContactStatus(row.contact_id, 'Not Contacted');
    return true;
  },

  /**
   * Mark a recipient as having replied: stop remaining sends, record the reply
   * (so the Replied metric reflects it), and flag the contact as "Replied".
   */
  markReplied(enrollmentId: string): boolean {
    const row = db.prepare('SELECT contact_id FROM sequence_enrollments WHERE id = ?').get(enrollmentId) as
      | { contact_id: string | null }
      | undefined;
    if (!row) return false;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE sequence_enrollments SET status = 'replied', next_send_at = NULL, updated_at = ? WHERE id = ?`
    ).run(now, enrollmentId);
    // Mark their most recent send as replied for the metrics.
    db.prepare(
      `UPDATE sequence_sends SET status = 'replied'
       WHERE id = (SELECT id FROM sequence_sends WHERE enrollment_id = ? ORDER BY created_at DESC LIMIT 1)`
    ).run(enrollmentId);
    if (row.contact_id) {
      db.prepare('UPDATE discovered_contacts SET status = ? WHERE id = ?').run('Replied', row.contact_id);
    }
    return true;
  },

  /**
   * Process all due sends across active sequences. Sends via SendGrid when
   * configured; otherwise logs a simulated send so the queue still advances.
   */
  async processQueue(): Promise<{ processed: number }> {
    const now = new Date().toISOString();
    const due = db
      .prepare(
        `SELECT e.* FROM sequence_enrollments e
         JOIN sequences s ON s.id = e.sequence_id
         WHERE e.status = 'active' AND s.status = 'active'
           AND e.next_send_at IS NOT NULL AND e.next_send_at <= ?`
      )
      .all(now) as Record<string, unknown>[];

    let processed = 0;
    for (const e of due) {
      const seq = this.get(e.sequence_id as string);
      if (!seq) continue;
      const stepIdx = e.current_step as number;
      const step = seq.steps[stepIdx];
      const enrollmentId = e.id as string;
      const email = e.contact_email as string;

      if (!step) {
        db.prepare(`UPDATE sequence_enrollments SET status = 'completed', next_send_at = NULL, updated_at = ? WHERE id = ?`).run(
          now,
          enrollmentId
        );
        syncContactStatus(e.contact_id as string | null, 'Contacted');
        continue;
      }

      // Personalize merge fields ({{greeting}}, {{name}}, {{firstName}}, {{senderName}}).
      const vars = contactVars(e.contact_name as string | null, email);
      const finalSubject = emailService.replaceVariables(step.subject, vars);
      const finalBody = emailService.replaceVariables(step.body, vars);

      // Attempt a real send only if the mailbox/provider is configured.
      if (emailService.isConfigured()) {
        try {
          await emailService.sendEmail(email, finalSubject, finalBody, {});
        } catch (err) {
          console.error('Sequence send failed:', err);
        }
      }

      db.prepare(
        `INSERT INTO sequence_sends (id, sequence_id, enrollment_id, step_index, subject, to_email, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`
      ).run(`snd_${randomUUID()}`, seq.id, enrollmentId, stepIdx, finalSubject, email, now);

      const nextIdx = stepIdx + 1;
      const nextStep = seq.steps[nextIdx];
      if (nextStep) {
        db.prepare(
          `UPDATE sequence_enrollments SET current_step = ?, next_send_at = ?, updated_at = ? WHERE id = ?`
        ).run(nextIdx, daysFromNow(nextStep.delayDays || 0), now, enrollmentId);
      } else {
        db.prepare(
          `UPDATE sequence_enrollments SET current_step = ?, status = 'completed', next_send_at = NULL, updated_at = ? WHERE id = ?`
        ).run(nextIdx, now, enrollmentId);
        syncContactStatus(e.contact_id as string | null, 'Contacted');
      }
      processed++;
    }
    return { processed };
  },

  metrics(): SequenceMetrics {
    const activeSequences = (
      db.prepare(`SELECT COUNT(*) AS n FROM sequences WHERE status = 'active'`).get() as { n: number }
    ).n;
    const sends = db.prepare('SELECT status FROM sequence_sends').all() as { status: string }[];
    const emailsSent = sends.length;
    const opened = sends.filter((s) => s.status === 'opened' || s.status === 'replied').length;
    const replied = sends.filter((s) => s.status === 'replied').length;
    const bounced = sends.filter((s) => s.status === 'bounced').length;
    const inQueue = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM sequence_enrollments e JOIN sequences s ON s.id = e.sequence_id
           WHERE e.status = 'active' AND s.status = 'active' AND e.next_send_at IS NOT NULL`
        )
        .get() as { n: number }
    ).n;
    const avgOpenRate = emailsSent > 0 ? Math.round((opened / emailsSent) * 100) : 0;
    return { activeSequences, emailsSent, inQueue, bounced, opened, replied, avgOpenRate };
  },

  // ---------- Signatures ----------
  listSignatures(): Signature[] {
    const rows = db.prepare('SELECT * FROM signatures ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      body: r.body as string,
      isDefault: !!r.is_default,
      createdAt: r.created_at as string,
    }));
  },

  createSignature(name: string, body: string): Signature {
    const id = `sig_${randomUUID()}`;
    const now = new Date().toISOString();
    const isFirst = (db.prepare('SELECT COUNT(*) AS n FROM signatures').get() as { n: number }).n === 0;
    db.prepare('INSERT INTO signatures (id, name, body, is_default, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      name.trim(),
      body,
      isFirst ? 1 : 0,
      now
    );
    return this.listSignatures().find((s) => s.id === id)!;
  },

  deleteSignature(id: string): boolean {
    return db.prepare('DELETE FROM signatures WHERE id = ?').run(id).changes > 0;
  },

  // ---------- Mailbox ----------
  getMailbox(): Mailbox {
    const r = db.prepare('SELECT * FROM mailbox WHERE id = 1').get() as Record<string, unknown>;
    const serverProvider = emailService.provider();
    return {
      connected: !!r.connected,
      // Fall back to the env sender identity that the provider actually uses.
      fromEmail: (r.from_email as string) || process.env.FROM_EMAIL || undefined,
      fromName: (r.from_name as string) || process.env.FROM_NAME || undefined,
      provider: (r.provider as string) || undefined,
      serverConfigured: serverProvider !== 'none',
      serverProvider,
    };
  },

  /** Send a one-off test email through the configured provider. */
  async sendTestEmail(to: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return emailService.sendEmail(
      to,
      'TrialHub test email',
      'This is a test email from TrialHub confirming your email provider is connected.\n\nIf you can see this, outbound email is working.'
    );
  },

  connectMailbox(input: { fromEmail: string; fromName?: string; provider?: string }): Mailbox {
    db.prepare('UPDATE mailbox SET connected = 1, from_email = ?, from_name = ?, provider = ? WHERE id = 1').run(
      input.fromEmail,
      input.fromName || null,
      input.provider || 'SMTP',
      );
    return this.getMailbox();
  },

  disconnectMailbox(): Mailbox {
    db.prepare('UPDATE mailbox SET connected = 0 WHERE id = 1').run();
    return this.getMailbox();
  },
};
