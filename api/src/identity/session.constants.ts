export const SESSION_COOKIE = 'mes_session';
export const SESSION_LIFETIME_SECONDS = 4 * 60 * 60;
/** Pinned on both signing and verifying, so a token cannot choose its own algorithm. */
export const SESSION_ALGORITHM = 'HS256';
