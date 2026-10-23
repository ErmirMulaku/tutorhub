import { BadRequestDomainError } from '../common/errors.js';

/** Where a page ended: the last row's sort key. Lists sort by (startTime, id). */
export interface BookingCursor {
  startTime: Date;
  id: string;
}

/**
 * An opaque cursor: base64 of `startTime|id`. Clients must treat it as a
 * token and send it back unchanged (`after`), never build or parse it — which
 * leaves us free to change what's inside.
 */
export function encodeCursor(booking: BookingCursor): string {
  return Buffer.from(`${booking.startTime.toISOString()}|${booking.id}`).toString('base64');
}

export function decodeCursor(cursor: string): BookingCursor {
  const [iso, id] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
  const startTime = new Date(iso ?? '');
  if (id === undefined || id === '' || Number.isNaN(startTime.getTime())) {
    throw new BadRequestDomainError('Invalid cursor.');
  }
  return { startTime, id };
}
