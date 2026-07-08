import { Request, Response, NextFunction } from 'express';
import { authService, PublicUser } from '../services/authService.js';

// Augment Express' Request so downstream handlers can read req.user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export const SESSION_COOKIE = 'sid';

/** Gate a route: 401 unless the request carries a valid session cookie. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const user = authService.userForToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Sign in to continue' });
    return;
  }
  req.user = user;
  next();
}

/** Gate a route to admins only. Assumes requireAuth ran first. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden', message: 'Admins only' });
    return;
  }
  next();
}
