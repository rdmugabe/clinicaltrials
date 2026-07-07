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

router.post('/register', (req: Request, res: Response) => {
  try {
    const { email, password, name, code } = req.body || {};
    const { user, token } = authService.register({ email, password, name, code });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.status(201).json({ user });
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
