'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { lookupReset, resetPassword } from '@/lib/api';

function ResetInner() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    lookupReset(token)
      .then((r) => {
        setEmail(r.email);
        setStatus('valid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">
            T
          </div>
          <h1 className="text-xl font-bold text-slate-900">TrialHub</h1>
          <p className="mt-1 text-sm text-slate-500">Set a new password</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {status === 'checking' && <p className="text-center text-sm text-slate-500">Checking your link…</p>}

          {status === 'invalid' && (
            <div className="text-center">
              <p className="mb-4 text-sm text-slate-600">This reset link is invalid or has expired.</p>
              <button
                onClick={() => router.replace('/login')}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Back to sign in
              </button>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center">
              <p className="mb-4 text-sm text-slate-600">
                Password updated. You can now sign in with your new password.
              </p>
              <button
                onClick={() => router.replace('/login')}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Go to sign in
              </button>
            </div>
          )}

          {status === 'valid' && (
            <form onSubmit={submit}>
              <p className="mb-4 text-xs text-slate-500">
                Resetting the password for <span className="font-semibold text-slate-700">{email}</span>.
              </p>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">New password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="At least 8 characters"
                />
              </label>
              {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {busy ? 'Please wait…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
