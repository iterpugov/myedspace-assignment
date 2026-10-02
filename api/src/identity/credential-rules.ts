/** Usernames are easy for a child to type: lower-case letters, digits and underscores. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Length is what makes a password strong; the cap bounds the work of hashing it. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** The form a username is stored and compared in, which makes it case-insensitive. */
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Checks a username that has already been normalised. */
export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
