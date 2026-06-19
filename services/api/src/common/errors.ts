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
