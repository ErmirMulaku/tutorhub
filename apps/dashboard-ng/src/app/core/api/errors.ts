import { HttpErrorResponse } from '@angular/common/http';
import { GraphqlError } from './graphql-client';

/**
 * A short, human-readable message for anything an API call can throw — used
 * for failure actions and toasts so every caller reports errors the same way.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof GraphqlError) return err.message;
  if (err instanceof HttpErrorResponse) {
    return err.status === 0
      ? 'Could not reach the server.'
      : `Request failed (${String(err.status)}).`;
  }
  if (err instanceof Error && err.message !== '') return err.message;
  return fallback;
}
