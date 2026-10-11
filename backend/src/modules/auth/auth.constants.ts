export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Two tabs can refresh at the same moment with the same cookie. The loser of that
 * race presents a token that was rotated a few seconds earlier; inside this window
 * it is treated as a race, not as token theft.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export const REFRESH_COOKIE_NAME = 'refresh_token';
/** Matches the global /api prefix so the cookie is only sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = '/api/auth';
