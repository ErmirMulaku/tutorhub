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

/** Machine-readable codes a client can branch on when a write loses a race. */
export type ConflictCode = 'CONFLICT' | 'SLOT_UNAVAILABLE' | 'REQUEST_IN_PROGRESS';

/**
 * Raised when a write lost a race: the row changed between our read and our
 * write, a constraint rejected an overlapping booking, or the same idempotent
 * request is still running. Maps to HTTP 409, GraphQL `extensions.code` =
 * `code`, and gRPC `ABORTED`. Retrying after re-reading is usually safe.
 */
export class ConflictDomainError extends Error {
  constructor(
    message: string,
    readonly code: ConflictCode = 'CONFLICT',
  ) {
    super(message);
    this.name = 'ConflictDomainError';
  }
}

/**
 * The client reused an idempotency key for a different request (another
 * caller, or the same caller with a different body). That's a client bug, not
 * a retry, so it maps to HTTP 422 with code `IDEMPOTENCY_KEY_REUSED`.
 */
export class IdempotencyKeyReusedError extends Error {
  readonly code = 'IDEMPOTENCY_KEY_REUSED';

  constructor() {
    super('This Idempotency-Key was already used for a different request.');
    this.name = 'IdempotencyKeyReusedError';
  }
}
