import { describe, expect, it } from '@jest/globals';
import { decodeCursor, encodeCursor } from './booking-cursor.js';

describe('booking cursor', () => {
  it('round-trips startTime and id', () => {
    const at = { startTime: new Date('2031-01-01T10:00:00.000Z'), id: 'b-1' };
    expect(decodeCursor(encodeCursor(at))).toEqual(at);
  });

  it('rejects a cursor that was not made by us', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow('Invalid cursor.');
    expect(() => decodeCursor(Buffer.from('2031-01-01|').toString('base64'))).toThrow();
  });
});
