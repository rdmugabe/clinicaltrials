'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, register, getAuthConfig, getMe, lookupInvite, forgotPassword } from '@/lib/api';

type Mode = 'login' | 'register' | 'forgot';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get('invite') || undefined;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [signupCodeRequired, setSignupCodeRequired] = useState(false);
  const [inviteEmailPinned, setInviteEmailPinned] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the form. Learn whether signup needs a code, and
  // default fresh deployments (no users yet) to register.
  useEffect(() => {
    getMe()
      .then(() => router.replace('/'))
      .catch(() => {});
    getAuthConfig()
      .then((c) => {
        setSignupCodeRequired(c.signupCodeRequired);
        if (!c.hasUsers) setMode('register');
      })
      .catch(() => {});
  }, [router]);

  // Arriving via an invite link: switch to register and pin/prefill the email.
  useEffect(() => {
    if (!inviteToken) return;
    setMode('register');
    lookupInvite(inviteToken)
      .then((inv) => {
        if (inv.email) {
          setEmail(inv.email);
          setInviteEmailPinned(true);
        }
      })
      .catch((e) => setInviteError(e instanceof Error ? e.message : 'Invalid invite link'));
  }, [inviteToken]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await forgotPassword(email.trim());
        setNotice(
          'If an account exists for that email, a reset link has been sent. No email? Ask a team admin to generate a reset link for you.'
        );
        setBusy(false);
        return;
      }
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          code: code.trim() || undefined,
          inviteToken,
        });
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const heading =
    mode === 'login' ? 'Sign in to your workspace' : mode === 'register' ? 'Create your account' : 'Reset your password';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">
            T
          </div>
          <h1 className="text-xl font-bold text-slate-900">TrialHub</h1>
          <p className="mt-1 text-sm text-slate-500">{heading}</p>
        </div>

        {inviteToken && !inviteError && (
          <div className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
            You&apos;ve been invited to join this TrialHub workspace. Create your account below.
          </div>
        )}
        {inviteError && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{inviteError}</div>
        )}

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {mode === 'register' && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Jane Doe"
              />
            </label>
          )}

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviteEmailPinned}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="you@company.com"
            />
          </label>

          {mode !== 'forgot' && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Password</span>
              <input
                type="password"
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              />
            </label>
          )}

          {/* Signup code only when required AND not arriving through an invite. */}
          {mode === 'register' && signupCodeRequired && !inviteToken && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Signup code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Provided by your admin"
              />
            </label>
          )}

          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          {notice && <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
              ? 'Sign in'
              : mode === 'register'
              ? 'Create account'
              : 'Send reset link'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
              }}
              className="mt-3 block w-full text-center text-xs text-slate-500 hover:text-slate-700"
            >
              Forgot your password?
            </button>
          )}
        </form>

        {/* Bottom switcher — hidden on invite flow (they must register). */}
        {!inviteToken && (
          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account? " : mode === 'register' ? 'Already have an account? ' : ''}
            {mode === 'forgot' ? (
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setNotice(null);
                }}
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                Back to sign in
              </button>
            ) : (
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(null);
                }}
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
