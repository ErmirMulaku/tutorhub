'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@ermulaku/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import { interpolate } from '@/i18n/dictionaries';

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/** Singleton Stripe.js instance — only created when a publishable key is set. */
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

interface LessonPaymentFormProps {
  clientSecret: string;
  /** Localised total, e.g. "$55.00" — shown on the pay button. */
  amountLabel: string;
  dict: Dictionary;
  onSuccess: () => void;
}

function PayForm({
  amountLabel,
  dict,
  onSuccess,
}: Omit<LessonPaymentFormProps, 'clientSecret'>): React.JSX.Element {
  const stripe = useStripe();
  const elements = useElements();
  const t = dict.booking;
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    void stripe
      .confirmPayment({ elements, redirect: 'if_required' })
      .then(({ error: stripeError, paymentIntent }) => {
        if (stripeError) {
          setError(stripeError.message ?? t.payError);
        } else if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
          onSuccess();
        } else {
          setError(t.payError);
        }
      })
      .catch(() => setError(t.payError))
      .finally(() => setPaying(false));
  };

  return (
    <form onSubmit={pay} className="payform">
      <PaymentElement />
      {error && <p className="booking__error">{error}</p>}
      <p className="booking__note">{t.paySecure}</p>
      <Button type="submit" block disabled={!stripe || paying}>
        {paying ? t.payProcessing : interpolate(t.payNow, { amount: amountLabel })}
      </Button>
    </form>
  );
}

/** Stripe Payment Element wired to a lesson PaymentIntent's client secret. */
export function LessonPaymentForm({
  clientSecret,
  amountLabel,
  dict,
  onSuccess,
}: LessonPaymentFormProps): React.JSX.Element {
  if (stripePromise === null) {
    // No publishable key — callers should have fallen back to the free flow.
    return <p className="booking__error">{dict.booking.payError}</p>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PayForm amountLabel={amountLabel} dict={dict} onSuccess={onSuccess} />
    </Elements>
  );
}
