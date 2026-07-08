import { Router, Request, Response } from 'express';
import { authService, Role } from '../services/authService.js';
import { requireAdmin } from '../middleware/requireAuth.js';

const router = Router();

function appBaseUrl(): string {
  return (process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3002').replace(/\/$/, '');
}

function fail(res: Response, err: unknown): void {
  const status = err instanceof authService.AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Something went wrong';
  if (status === 500) console.error('Team route error:', err);
  res.status(status).json({ error: message });
}

const inviteUrl = (token: string) => `${appBaseUrl()}/login?invite=${token}`;

// Any signed-in member can see who's on the team.
router.get('/members', (_req: Request, res: Response) => {
  res.json({ members: authService.listUsers() });
});

// --- Everything below is admin-only ---
router.use(requireAdmin);

router.delete('/members/:id', (req: Request, res: Response) => {
  try {
    authService.removeUser(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

router.patch('/members/:id/role', (req: Request, res: Response) => {
  try {
    const role: Role = req.body?.role === 'admin' ? 'admin' : 'member';
    const user = authService.setRole(req.params.id, role, req.user!.id);
    res.json({ user });
  } catch (err) {
    fail(res, err);
  }
});

// Generate a one-time reset link an admin can hand to a locked-out teammate.
router.post('/members/:id/reset-link', (req: Request, res: Response) => {
  try {
    const user = authService.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const token = authService.createReset(user.id);
    res.json({ url: `${appBaseUrl()}/reset?token=${token}`, email: user.email });
  } catch (err) {
    fail(res, err);
  }
});

router.get('/invites', (_req: Request, res: Response) => {
  res.json({ invites: authService.listInvites().map((i) => ({ ...i, url: inviteUrl(i.token) })) });
});

router.post('/invites', (req: Request, res: Response) => {
  try {
    const role: Role = req.body?.role === 'admin' ? 'admin' : 'member';
    const email = (req.body?.email as string)?.trim() || undefined;
    const invite = authService.createInvite({ email, role, createdBy: req.user!.id });
    res.status(201).json({ invite: { ...invite, url: inviteUrl(invite.token) } });
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/invites/:token', (req: Request, res: Response) => {
  authService.revokeInvite(req.params.token);
  res.json({ ok: true });
});

export default router;
