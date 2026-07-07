import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';

// Sessions live for 30 days; the cookie carries an opaque, server-stored token
// so a session can be revoked (logout / delete row) independent of any JWT.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
}

const norm = (email: string) => email.trim().toLowerCase();
const toPublic = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.created_at,
});

class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const authService = {
  AuthError,

  /** True once at least one account exists — used to gate first-run vs. locked signup. */
  hasUsers(): boolean {
    return !!db.prepare('SELECT 1 FROM users LIMIT 1').get();
  },

  count(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  },

  /**
   * Create an account. Registration is open unless SIGNUP_CODE is set, in which
   * case the caller must supply the matching code (a lightweight gate that keeps
   * strangers out without a full invite system).
   */
  register(input: { email: string; password: string; name?: string; code?: string }): {
    user: PublicUser;
    token: string;
  } {
    const email = norm(input.email || '');
    const password = input.password || '';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new AuthError('Enter a valid email address');
    }
    if (password.length < 8) {
      throw new AuthError('Password must be at least 8 characters');
    }
    const required = process.env.SIGNUP_CODE;
    if (required && input.code !== required) {
      throw new AuthError('Invalid or missing signup code', 403);
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new AuthError('An account with that email already exists', 409);
    }

    const id = `usr_${crypto.randomUUID()}`;
    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, hash, input.name?.trim() || null, now);

    const user = toPublic({ id, email, password_hash: hash, name: input.name?.trim() || null, created_at: now });
    return { user, token: this.createSession(id) };
  },

  login(input: { email: string; password: string }): { user: PublicUser; token: string } {
    const email = norm(input.email || '');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    // Compare even when the user is missing to blunt timing-based enumeration.
    const ok = row
      ? bcrypt.compareSync(input.password || '', row.password_hash)
      : bcrypt.compareSync(input.password || '', '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!row || !ok) {
      throw new AuthError('Incorrect email or password', 401);
    }
    return { user: toPublic(row), token: this.createSession(row.id) };
  },

  createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    db.prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, userId, new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString());
    return token;
  },

  /** Resolve the user for a session token, or null if missing/expired. */
  userForToken(token: string | undefined): PublicUser | null {
    if (!token) return null;
    const s = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as
      | { user_id: string; expires_at: string }
      | undefined;
    if (!s) return null;
    if (new Date(s.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id) as UserRow | undefined;
    return u ? toPublic(u) : null;
  },

  logout(token: string | undefined): void {
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },
};

export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
