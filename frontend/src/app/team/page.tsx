'use client';

import { useCallback, useEffect, useState } from 'react';
import { useShell } from '@/components/shell/AppShell';
import {
  getMembers,
  removeMember,
  setMemberRole,
  createMemberResetLink,
  getInvites,
  createInvite,
  revokeInvite,
  type AuthUser,
  type Role,
  type TeamInvite,
} from '@/lib/api';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useShell();
  const isAdmin = user?.role === 'admin';

  const [members, setMembers] = useState<AuthUser[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [newInvite, setNewInvite] = useState<TeamInvite | null>(null);
  const [resetLink, setResetLink] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getMembers().then(setMembers).catch((e) => setError(e.message));
    if (isAdmin) getInvites().then(setInvites).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    setError(null);
    setBusy(true);
    try {
      const inv = await createInvite({ email: inviteEmail.trim() || undefined, role: inviteRole });
      setNewInvite(inv);
      setInviteEmail('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const pendingInvites = invites.filter((i) => i.status === 'pending');

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everyone on the team shares one workspace — the same scouts, contacts, and pipeline.
          {isAdmin ? ' As an admin you can invite and manage members.' : ' Contact an admin to invite teammates.'}
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Invite (admin only) */}
      {isAdmin && (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Invite a teammate</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Email (optional — pins the invite)</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Role</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button
              onClick={handleInvite}
              disabled={busy}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              Generate invite link
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Email is sandboxed, so invites aren&apos;t sent automatically — copy the link and share it (Slack, email,
            etc.). Links expire in 7 days.
          </p>
          {newInvite && <CopyField label="Invite link — share with your teammate" value={newInvite.url} />}
        </section>
      )}

      {/* Members */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
          Members ({members.length})
        </div>
        <div className="divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                {(m.name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">
                  {m.name || m.email}
                  {m.id === user?.id && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{m.email}</div>
              </div>

              {isAdmin ? (
                <select
                  value={m.role}
                  onChange={(e) => act(() => setMemberRole(m.id, e.target.value as Role))}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-primary-500 focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    m.role === 'admin' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {m.role}
                </span>
              )}

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      act(async () => {
                        const r = await createMemberResetLink(m.id);
                        setResetLink({ id: m.id, url: r.url });
                      })
                    }
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reset link
                  </button>
                  {m.id !== user?.id && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.name || m.email} from the team? They'll be signed out immediately.`))
                          act(() => removeMember(m.id));
                      }}
                      disabled={busy}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}

              {resetLink?.id === m.id && (
                <div className="w-full">
                  <CopyField label="Password reset link — hand to this teammate (expires in 2h)" value={resetLink.url} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pending invites (admin only) */}
      {isAdmin && pendingInvites.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
            Pending invites ({pendingInvites.length})
          </div>
          <div className="divide-y divide-slate-100">
            {pendingInvites.map((inv) => (
              <div key={inv.token} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-700">{inv.email || 'Anyone with the link'}</div>
                  <div className="text-xs text-slate-400">
                    {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(inv.url);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Copy link
                </button>
                <button
                  onClick={() => act(() => revokeInvite(inv.token))}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
