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
