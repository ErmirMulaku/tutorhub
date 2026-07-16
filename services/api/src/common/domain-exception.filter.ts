import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';
import { InvalidBookingTransitionError } from '../bookings/booking.errors.js';
import { BadRequestDomainError, EmailNotVerifiedError, EntityNotFoundError } from './errors.js';

type DomainError =
  | EntityNotFoundError
  | InvalidBookingTransitionError
  | BadRequestDomainError
  | EmailNotVerifiedError;

/**
 * Maps transport-agnostic domain errors to the right shape per transport:
 * - HTTP: status code + JSON body (404 / 409 / 403 / 400)
 * - GraphQL: a typed `GraphQLError` (`NOT_FOUND` / `EMAIL_NOT_VERIFIED` / `BAD_USER_INPUT`)
 */
@Catch(
  EntityNotFoundError,
  InvalidBookingTransitionError,
  BadRequestDomainError,
  EmailNotVerifiedError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): GraphQLError | void {
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
}
