import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';

// Sessions live for 30 days; the cookie carries an opaque, server-stored token
// so a session can be revoked (logout / delete row) independent of any JWT.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // invite links valid for a week
const RESET_TTL_MS = 2 * 60 * 60 * 1000; // password-reset links valid for 2 hours

export type Role = 'admin' | 'member';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface Invite {
  token: string;
  email: string | null;
  role: Role;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  created_at: string;
}

const norm = (email: string) => email.trim().toLowerCase();
const toPublic = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role === 'admin' ? 'admin' : 'member',
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

  hasUsers(): boolean {
    return !!db.prepare('SELECT 1 FROM users LIMIT 1').get();
  },

  count(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  },

  /**
   * Create an account. Authorization, in priority order:
   *  1. The very first account bootstraps the team as an admin (no code needed).
   *  2. A valid invite token authorizes and sets the role (email is pinned if the
   *     invite specified one).
   *  3. Otherwise, if SIGNUP_CODE is set the caller must supply it; if it isn't,
   *     registration is open.
   */
  register(input: {
    email: string;
    password: string;
    name?: string;
    code?: string;
    inviteToken?: string;
  }): { user: PublicUser; token: string } {
    const email = norm(input.email || '');
    const password = input.password || '';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new AuthError('Enter a valid email address');
    }
    if (password.length < 8) {
      throw new AuthError('Password must be at least 8 characters');
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new AuthError('An account with that email already exists', 409);
    }

    const isFirstUser = this.count() === 0;
    let role: Role = 'member';
    let invite: Invite | null = null;

    if (isFirstUser) {
      role = 'admin';
    } else if (input.inviteToken) {
      invite = this.getValidInvite(input.inviteToken);
      if (!invite) throw new AuthError('This invite link is invalid or has expired', 403);
      if (invite.email && norm(invite.email) !== email) {
        throw new AuthError('This invite was issued for a different email address', 403);
      }
      role = invite.role;
    } else {
      const required = process.env.SIGNUP_CODE;
      if (required && input.code !== required) {
        throw new AuthError('A valid invite link or signup code is required', 403);
      }
    }

    const id = `usr_${crypto.randomUUID()}`;
    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, email, hash, input.name?.trim() || null, role, now);

    if (invite) {
      db.prepare('UPDATE invites SET accepted_at = ?, accepted_by = ? WHERE token = ?').run(now, id, invite.token);
    }

    const user = toPublic({ id, email, password_hash: hash, name: input.name?.trim() || null, role, created_at: now });
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

  // ---- Team management --------------------------------------------------
  listUsers(): PublicUser[] {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as UserRow[];
    return rows.map(toPublic);
  },

  getUser(id: string): PublicUser | null {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return u ? toPublic(u) : null;
  },

  adminCount(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }).n;
  },

  /** Remove a teammate and revoke their sessions. Guards against lockout. */
  removeUser(id: string, actingUserId: string): void {
    if (id === actingUserId) throw new AuthError("You can't remove your own account", 400);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!target) throw new AuthError('User not found', 404);
    if (target.role === 'admin' && this.adminCount() <= 1) {
      throw new AuthError('Cannot remove the last admin', 400);
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  /** Change a teammate's role, keeping at least one admin. */
  setRole(id: string, role: Role, actingUserId: string): PublicUser {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!target) throw new AuthError('User not found', 404);
    if (role === 'member' && target.role === 'admin' && this.adminCount() <= 1) {
      throw new AuthError('Cannot demote the last admin', 400);
    }
    if (id === actingUserId && role === 'member' && this.adminCount() <= 1) {
      throw new AuthError('Cannot demote the last admin', 400);
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    return this.getUser(id)!;
  },

  // ---- Invites ----------------------------------------------------------
  createInvite(input: { email?: string; role?: Role; createdBy: string }): Invite {
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const email = input.email ? norm(input.email) : null;
    const role: Role = input.role === 'admin' ? 'admin' : 'member';
    db.prepare(
      'INSERT INTO invites (token, email, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(token, email, role, input.createdBy, new Date(now).toISOString(), new Date(now + INVITE_TTL_MS).toISOString());
    return this.getInvite(token)!;
  },

  getInvite(token: string): Invite | null {
    const r = db.prepare('SELECT * FROM invites WHERE token = ?').get(token) as
      | {
          token: string;
          email: string | null;
          role: string;
          created_by: string | null;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
        }
      | undefined;
    if (!r) return null;
    return {
      token: r.token,
      email: r.email,
      role: r.role === 'admin' ? 'admin' : 'member',
      createdBy: r.created_by,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
    };
  },

  /** A pending invite that hasn't been accepted or expired, else null. */
  getValidInvite(token: string): Invite | null {
    const inv = this.getInvite(token);
    if (!inv || inv.acceptedAt) return null;
    if (new Date(inv.expiresAt).getTime() < Date.now()) return null;
    return inv;
  },

  listInvites(): (Invite & { status: 'pending' | 'accepted' | 'expired' })[] {
    const rows = db.prepare('SELECT token FROM invites ORDER BY created_at DESC').all() as { token: string }[];
    return rows
      .map((r) => this.getInvite(r.token)!)
      .map((inv) => {
        const status = inv.acceptedAt
          ? 'accepted'
          : new Date(inv.expiresAt).getTime() < Date.now()
          ? 'expired'
          : 'pending';
        return { ...inv, status };
      });
  },

  revokeInvite(token: string): void {
    db.prepare('DELETE FROM invites WHERE token = ?').run(token);
  },

  // ---- Password reset ---------------------------------------------------
  createReset(userId: string): string {
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    db.prepare(
      'INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, userId, new Date(now).toISOString(), new Date(now + RESET_TTL_MS).toISOString());
    return token;
  },

  /** Create a reset for an email if it exists (null otherwise — no enumeration). */
  createResetByEmail(email: string): { token: string; user: PublicUser } | null {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(norm(email)) as UserRow | undefined;
    if (!row) return null;
    return { token: this.createReset(row.id), user: toPublic(row) };
  },

  getResetUser(token: string): PublicUser | null {
    const r = db.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token = ?').get(token) as
      | { user_id: string; expires_at: string; used_at: string | null }
      | undefined;
    if (!r || r.used_at) return null;
    if (new Date(r.expires_at).getTime() < Date.now()) return null;
    return this.getUser(r.user_id);
  },

  /** Consume a reset token, set the new password, and revoke existing sessions. */
  resetPassword(token: string, newPassword: string): PublicUser {
    if ((newPassword || '').length < 8) throw new AuthError('Password must be at least 8 characters');
    const r = db.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token = ?').get(token) as
      | { user_id: string; expires_at: string; used_at: string | null }
      | undefined;
    if (!r || r.used_at || new Date(r.expires_at).getTime() < Date.now()) {
      throw new AuthError('This reset link is invalid or has expired', 400);
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, r.user_id);
    db.prepare('UPDATE password_resets SET used_at = ? WHERE token = ?').run(now, token);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(r.user_id); // force re-login everywhere
    return this.getUser(r.user_id)!;
  },
};

export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
