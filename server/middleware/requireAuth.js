import { verifySession, SESSION_COOKIE } from '../services/authService.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = token && verifySession(token);
  if (!user) return res.status(401).json({ error: 'Sign in with GitHub to use Spaces.' });
  req.user = user;
  next();
}
