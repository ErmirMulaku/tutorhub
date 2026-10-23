import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { isRetryableStripeError, StripeService } from './stripe.service.js';

function serviceWithFakeKey(): StripeService {
  const config = { get: () => 'sk_test_fake' } as unknown as ConfigService;
  return new StripeService(config);
}

describe('isRetryableStripeError', () => {
  it('retries network errors and 5xx, never 4xx', () => {
    expect(isRetryableStripeError(new Stripe.errors.StripeConnectionError({ message: 'x' }))).toBe(
      true,
    );
    expect(
      isRetryableStripeError(new Stripe.errors.StripeAPIError({ message: 'x', statusCode: 503 })),
    ).toBe(true);
    expect(
      isRetryableStripeError(new Stripe.errors.StripeCardError({ message: 'x', statusCode: 402 })),
    ).toBe(false);
    expect(isRetryableStripeError(new Error('not stripe'))).toBe(false);
  });
});

describe('StripeService.createPaymentIntent', () => {
  it('retries a timeout with the SAME idempotency key, a timeout and no SDK retries', async () => {
    const stripe = serviceWithFakeKey();
    const create = jest
      .spyOn(stripe.client.paymentIntents, 'create')
      .mockRejectedValueOnce(new Stripe.errors.StripeConnectionError({ message: 'timed out' }))
      .mockResolvedValueOnce({ id: 'pi_1' } as Stripe.Response<Stripe.PaymentIntent>);

    const intent = await stripe.createPaymentIntent({
      amountCents: 5000,
      metadata: {},
      idempotencyKey: 'payment-intent:b1',
    });

    expect(intent.id).toBe('pi_1');
    expect(create).toHaveBeenCalledTimes(2);
    for (const call of create.mock.calls) {
      expect(call[1]).toEqual({
        idempotencyKey: 'payment-intent:b1',
        timeout: 10_000,
        maxNetworkRetries: 0,
      });
    }
  });

  it('does not retry a declined card', async () => {
    const stripe = serviceWithFakeKey();
    const create = jest
      .spyOn(stripe.client.paymentIntents, 'create')
      .mockRejectedValue(
        new Stripe.errors.StripeCardError({ message: 'declined', statusCode: 402 }),
      );

    await expect(
      stripe.createPaymentIntent({ amountCents: 5000, metadata: {}, idempotencyKey: 'k' }),
    ).rejects.toThrow('declined');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
