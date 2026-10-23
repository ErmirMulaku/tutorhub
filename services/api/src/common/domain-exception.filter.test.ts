import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { GraphQLError } from 'graphql';
import { DomainExceptionFilter } from './domain-exception.filter.js';
import { ConflictDomainError, IdempotencyKeyReusedError } from './errors.js';

interface FakeHttpHost {
  host: ArgumentsHost;
  status: jest.Mock<(code: number) => unknown>;
  json: jest.Mock<(body: unknown) => unknown>;
}

function httpHost(): FakeHttpHost {
  const json = jest.fn((body: unknown) => body);
  const status = jest.fn((code: number) => ({ code, json }));
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('DomainExceptionFilter — conflicts', () => {
  const filter = new DomainExceptionFilter();

  it('maps a conflict to HTTP 409 with its code', () => {
    const { host, status, json } = httpHost();
    filter.catch(new ConflictDomainError('Taken.', 'SLOT_UNAVAILABLE'), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'SLOT_UNAVAILABLE',
      message: 'Taken.',
    });
  });

  it('maps a conflict to a GraphQL error carrying its code', () => {
    const host = { getType: () => 'graphql' } as unknown as ArgumentsHost;
    const error = filter.catch(new ConflictDomainError('Changed.'), host);
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions['code']).toBe('CONFLICT');
  });
});

describe('DomainExceptionFilter — idempotency key reuse', () => {
  it('maps to HTTP 422 with code IDEMPOTENCY_KEY_REUSED', () => {
    const { host, status, json } = httpHost();
    new DomainExceptionFilter().catch(new IdempotencyKeyReusedError(), host);
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 422, code: 'IDEMPOTENCY_KEY_REUSED' }),
    );
  });
});
