import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidBookingTransitionError } from '../bookings/booking.errors.js';
import { EntityNotFoundError } from './errors.js';

type DomainError = EntityNotFoundError | InvalidBookingTransitionError;

/** Maps transport-agnostic domain errors to HTTP responses. */
@Catch(EntityNotFoundError, InvalidBookingTransitionError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isNotFound = exception instanceof EntityNotFoundError;
    const status = isNotFound ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;

    response.status(status).json({
      statusCode: status,
      error: isNotFound ? 'Not Found' : 'Conflict',
      message: exception.message,
    });
  }
}
