/** Raised by the service layer when a referenced entity does not exist. */
export class EntityNotFoundError extends Error {
  constructor(
    readonly entity: string,
    readonly id: string,
  ) {
    super(`${entity} ${id} was not found.`);
    this.name = 'EntityNotFoundError';
  }
}

/** Raised when a request is well-formed but violates a business rule. */
export class BadRequestDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestDomainError';
  }
}

/**
 * Raised when credentials are correct but the account's email is unverified.
 *
 * Distinct from `UnauthorizedException` on purpose: the password was right, so
 * the caller is not guessing, and the client needs to tell this apart from a
 * bad password to offer the code again instead of a dead end. It maps to its
 * own `EMAIL_NOT_VERIFIED` code so clients can branch on that rather than
 * matching the message text.
 */
export class EmailNotVerifiedError extends Error {
  constructor(message = 'Verify your email address before signing in.') {
    super(message);
    this.name = 'EmailNotVerifiedError';
  }
}
