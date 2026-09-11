import jwt from 'jsonwebtoken';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

const COOKIE_NAME = 'spaces_session';
const SESSION_TTL = '7d';

export function buildAuthorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  });
  return `${GITHUB_AUTHORIZE_URL}?${params}`;
}

export async function exchangeCodeForUser(code, redirectUri) {
  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || 'GitHub did not return an access token');
  }

  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!userRes.ok) throw new Error(`GitHub user lookup failed: ${userRes.status}`);
  const user = await userRes.json();

  return { login: user.login, name: user.name, avatarUrl: user.avatar_url };
}

export function signSession(user) {
  return jwt.sign(user, process.env.SESSION_SECRET, { expiresIn: SESSION_TTL });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, process.env.SESSION_SECRET);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export const SESSION_COOKIE = COOKIE_NAME;
