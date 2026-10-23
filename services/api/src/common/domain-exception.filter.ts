import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';
import { InvalidBookingTransitionError } from '../bookings/booking.errors.js';
import {
  BadRequestDomainError,
  ConflictDomainError,
  EmailNotVerifiedError,
  EntityNotFoundError,
} from './errors.js';

type DomainError =
  | EntityNotFoundError
  | InvalidBookingTransitionError
  | BadRequestDomainError
  | EmailNotVerifiedError
  | ConflictDomainError;

/**
 * Maps transport-agnostic domain errors to the right shape per transport:
 * - HTTP: status code + JSON body (404 / 409 / 403 / 400); a conflict also
 *   carries its `code` so clients can tell `SLOT_UNAVAILABLE` from `CONFLICT`
 * - GraphQL: a typed `GraphQLError` (`NOT_FOUND` / `EMAIL_NOT_VERIFIED` /
 *   `BAD_USER_INPUT`, or the conflict's own code)
 */
@Catch(
  EntityNotFoundError,
  InvalidBookingTransitionError,
  BadRequestDomainError,
  EmailNotVerifiedError,
  ConflictDomainError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): GraphQLError | void {
    if (exception instanceof ConflictDomainError) {
      return this.conflict(exception, host);
    }

    const isNotFound = exception instanceof EntityNotFoundError;
    const isUnverified = exception instanceof EmailNotVerifiedError;

    if (host.getType<GqlContextType>() === 'graphql') {
      return new GraphQLError(exception.message, {
        extensions: {
          code: isNotFound ? 'NOT_FOUND' : isUnverified ? 'EMAIL_NOT_VERIFIED' : 'BAD_USER_INPUT',
        },
      });
    }

    const status = isNotFound
      ? HttpStatus.NOT_FOUND
      : isUnverified
        ? HttpStatus.FORBIDDEN
        : exception instanceof InvalidBookingTransitionError
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;
    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({ statusCode: status, message: exception.message });
  }

  private conflict(exception: ConflictDomainError, host: ArgumentsHost): GraphQLError | void {
    if (host.getType<GqlContextType>() === 'graphql') {
      return new GraphQLError(exception.message, { extensions: { code: exception.code } });
    }
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(HttpStatus.CONFLICT)
      .json({ statusCode: HttpStatus.CONFLICT, code: exception.code, message: exception.message });
  }
}
