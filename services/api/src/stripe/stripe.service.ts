import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { withRetry } from '../common/retry.js';

/** Give up on one Stripe call after this long (the SDK default is 80s). */
const STRIPE_TIMEOUT_MS = 10_000;

/**
 * Only retry when the request may not have reached Stripe or Stripe failed on
 * its side: a network error/timeout, or a 5xx. A 4xx (bad card, bad params)
 * will fail the same way every time.
 */
export function isRetryableStripeError(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeConnectionError) return true;
  return error instanceof Stripe.errors.StripeError && (error.statusCode ?? 0) >= 500;
}

/**
 * Thin wrapper around the Stripe SDK, configured from `STRIPE_SECRET_KEY`.
 *
 * The whole payment loop runs in Stripe **test mode** (use an `sk_test_…` key):
 * students are charged via PaymentIntents, funds are held on the platform
 * balance, then Transfers move net earnings to each tutor's Connect (Express)
 * account, from which Payouts settle. No real money moves with test keys.
 *
 * When no key is configured the client is left `null` and {@link enabled} is
 * false, so the app still boots (seeded/demo data) — the payment resolvers
 * surface a clear error instead of crashing at startup.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key === undefined || key === '') {
      this.stripe = null;
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe features are disabled.');
    } else {
      this.stripe = new Stripe(key);
      if (!key.startsWith('sk_test_')) {
        this.logger.warn('STRIPE_SECRET_KEY is not a test key — live money can move.');
      }
    }
  }

  /** Whether a Stripe client is configured. */
  get enabled(): boolean {
    return this.stripe !== null;
  }

  /** The configured client, or throw a clear error if Stripe is not set up. */
  get client(): Stripe {
    if (this.stripe === null) {
      throw new Error('Stripe is not configured — set STRIPE_SECRET_KEY.');
    }
    return this.stripe;
  }

  /** The webhook signing secret (`whsec_…`) used to verify incoming events. */
  get webhookSecret(): string | undefined {
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  // --- Connect (Express) accounts for tutor payouts ------------------------

  /** Create a Connect Express account a tutor will onboard into. */
  createExpressAccount(email: string | null): Promise<Stripe.Account> {
    return this.client.accounts.create({
      type: 'express',
      email: email ?? undefined,
      capabilities: { transfers: { requested: true } },
    });
  }

  /** A one-time hosted onboarding link for a Connect account. */
  createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    return this.client.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  /** Fetch a Connect account (used to read `payouts_enabled`). */
  retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.client.accounts.retrieve(accountId);
  }

  // --- Charges (student pays for a booking) --------------------------------

  /**
   * Charge the platform for a booking. Funds land on the platform balance and
   * are transferred to the tutor's connected account once cleared (separate
   * charge & transfer), so no `transfer_data` is set here.
   *
   * Safe to retry: `idempotencyKey` (derived from the booking id) makes Stripe
   * return the SAME PaymentIntent for a repeated request instead of creating
   * a second one. So when a call times out and we don't know if it reached
   * Stripe, we can just send it again. The SDK's own retries are turned off
   * (`maxNetworkRetries: 0`) so retrying happens in one place, here.
   */
  createPaymentIntent(params: {
    amountCents: number;
    currency?: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    return withRetry(
      () =>
        this.client.paymentIntents.create(
          {
            amount: params.amountCents,
            currency: params.currency ?? 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: params.metadata,
          },
          {
            idempotencyKey: params.idempotencyKey,
            timeout: STRIPE_TIMEOUT_MS,
            maxNetworkRetries: 0,
          },
        ),
      { attempts: 3, baseMs: 200, isRetryable: isRetryableStripeError },
    );
  }

  // --- Payouts (transfer net earnings to a tutor) --------------------------

  /** Move funds from the platform balance to a tutor's connected account. */
  createTransfer(params: {
    amountCents: number;
    destination: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Transfer> {
    return this.client.transfers.create({
      amount: params.amountCents,
      currency: 'usd',
      destination: params.destination,
      metadata: params.metadata,
    });
  }

  /** Verify + parse a webhook event against the raw request body. */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.webhookSecret;
    if (secret === undefined || secret === '') {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }
}
