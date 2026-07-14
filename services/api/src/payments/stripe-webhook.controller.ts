import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { StripeService } from '../stripe/stripe.service.js';
import { PaymentsService } from './payments.service.js';

/**
 * Receives Stripe webhook events. The signature is verified against the raw
 * request body (enabled via `rawBody: true` in main.ts), so forged calls are
 * rejected before touching any records.
 */
@ApiExcludeController()
@Controller('stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripe: StripeService,
    private readonly payments: PaymentsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (req.rawBody === undefined || signature === undefined) {
      throw new BadRequestException('Missing webhook body or signature.');
    }
    let event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid webhook signature.');
    }
    await this.payments.handleWebhookEvent(event);
    return { received: true };
  }
}
