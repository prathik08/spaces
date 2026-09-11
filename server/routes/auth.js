import express from 'express';
import crypto from 'crypto';
import {
  buildAuthorizeUrl,
  exchangeCodeForUser,
  signSession,
  verifySession,
  cookieOptions,
  SESSION_COOKIE,
} from '../services/authService.js';

const router = express.Router();

function callbackUrl() {
  return `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/github/callback`;
}

router.get('/auth/github', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('spaces_oauth_state', state, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: 'lax' });
  res.redirect(buildAuthorizeUrl(callbackUrl(), state));
});

router.get('/auth/github/callback', async (req, res) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const { code, state } = req.query;

  if (!code || !state || state !== req.cookies?.spaces_oauth_state) {
    return res.redirect(`${clientOrigin}/?auth_error=1`);
  }

  try {
    const user = await exchangeCodeForUser(code, callbackUrl());
    const token = signSession(user);
    res.clearCookie('spaces_oauth_state');
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.redirect(clientOrigin);
  } catch (err) {
    console.error('GitHub auth error:', err.message);
    res.redirect(`${clientOrigin}/?auth_error=1`);
  }
});

router.get('/auth/me', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = token && verifySession(token);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.json({ ok: true });
});

export default router;
