/** Deliberately simple RFC-5322-ish check — good enough to catch typos, not exhaustive. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Minimum password length enforced across sign-up forms. */
export const MIN_PASSWORD_LENGTH = 8;

/** Returns a user-facing error, or `null` when the password is acceptable. */
export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
