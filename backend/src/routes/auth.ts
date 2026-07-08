import { Router, Request, Response, CookieOptions } from 'express';
import { authService, SESSION_TTL_SECONDS } from '../services/authService.js';
import { SESSION_COOKIE } from '../middleware/requireAuth.js';

const router = Router();

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

// Public base URL of the app, used to build reset links that point at the
// frontend (which proxies /api). Mirrors suppressionService's resolution.
function appBaseUrl(): string {
  return (process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3002').replace(/\/$/, '');
}

function fail(res: Response, err: unknown): void {
  const status = err instanceof authService.AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Something went wrong';
  if (status === 500) console.error('Auth error:', err);
  res.status(status).json({ error: message });
}

// Whether signups are open — lets the UI show a code field / disable register.
router.get('/config', (_req: Request, res: Response) => {
  res.json({ signupCodeRequired: !!process.env.SIGNUP_CODE, hasUsers: authService.hasUsers() });
});

// Look up an invite so the register form can pin/prefill the email and role.
router.get('/invite/:token', (req: Request, res: Response) => {
  const inv = authService.getValidInvite(req.params.token);
  if (!inv) {
    res.status(404).json({ error: 'This invite link is invalid or has expired' });
    return;
  }
  res.json({ invite: { email: inv.email, role: inv.role } });
});

router.post('/register', (req: Request, res: Response) => {
  try {
    const { email, password, name, code, inviteToken } = req.body || {};
    const { user, token } = authService.register({ email, password, name, code, inviteToken });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.status(201).json({ user });
  } catch (err) {
    fail(res, err);
  }
});

// Self-serve password reset request. Always 200 (no account enumeration); emails
// the link when a mail provider is configured.
router.post('/forgot', async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email as string) || '';
    const made = authService.createResetByEmail(email);
    if (made) {
      const url = `${appBaseUrl()}/reset?token=${made.token}`;
      const { emailService } = await import('../services/emailService.js');
      if (emailService.isConfigured()) {
        await emailService
          .sendEmail(
            made.user.email,
            'Reset your TrialHub password',
            `Someone requested a password reset for your TrialHub account.\n\nReset it here (link expires in 2 hours):\n${url}\n\nIf this wasn't you, you can ignore this email.`
          )
          .catch(() => undefined);
      }
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// Validate a reset token (so the reset page can show whose account it is).
router.get('/reset/:token', (req: Request, res: Response) => {
  const user = authService.getResetUser(req.params.token);
  if (!user) {
    res.status(404).json({ error: 'This reset link is invalid or has expired' });
    return;
  }
  res.json({ email: user.email });
});

router.post('/reset', (req: Request, res: Response) => {
  try {
    const { token, password } = req.body || {};
    const user = authService.resetPassword(token, password);
    // Reset revokes sessions; require a fresh sign-in rather than auto-login.
    res.json({ ok: true, email: user.email });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const { user, token } = authService.login({ email, password });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.json({ user });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  authService.logout(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Current user (200 with user, or 401 if not signed in).
router.get('/me', (req: Request, res: Response) => {
  const user = authService.userForToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user });
});

export default router;
