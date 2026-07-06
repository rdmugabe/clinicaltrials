import crypto from 'crypto';
import { db } from '../db/database.js';

// Signs unsubscribe links so they can't be forged or enumerated. Set
// UNSUBSCRIBE_SECRET in production; the dev fallback keeps local links working.
const SECRET = process.env.UNSUBSCRIBE_SECRET || 'trialhub-dev-unsubscribe-secret';

const norm = (email: string) => email.trim().toLowerCase();

export const suppressionService = {
  isSuppressed(email: string): boolean {
    return !!db.prepare('SELECT 1 FROM email_suppressions WHERE email = ?').get(norm(email));
  },

  suppress(email: string, reason = 'unsubscribe'): void {
    db.prepare(
      `INSERT INTO email_suppressions (email, reason, created_at) VALUES (?, ?, ?)
       ON CONFLICT(email) DO NOTHING`
    ).run(norm(email), reason, new Date().toISOString());
  },

  /** A short HMAC token that authenticates an unsubscribe link for one address. */
  token(email: string): string {
    return crypto.createHmac('sha256', SECRET).update(norm(email)).digest('hex').slice(0, 32);
  },

  verify(email: string, token: string | undefined): boolean {
    if (!email || !token) return false;
    const expected = this.token(email);
    // constant-time compare
    return expected.length === token.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  },

  /** Public unsubscribe URL for a recipient (points at the app, proxied to /api). */
  unsubscribeUrl(email: string): string {
    const base = process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3002';
    return `${base.replace(/\/$/, '')}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${this.token(email)}`;
  },

  list(): { email: string; reason?: string; createdAt: string }[] {
    const rows = db.prepare('SELECT * FROM email_suppressions ORDER BY created_at DESC').all() as {
      email: string;
      reason: string | null;
      created_at: string;
    }[];
    return rows.map((r) => ({ email: r.email, reason: r.reason || undefined, createdAt: r.created_at }));
  },
};
