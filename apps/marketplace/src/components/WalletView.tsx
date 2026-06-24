'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Modal, Price } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import {
  addPaymentMethodAction,
  buyGiftCardAction,
  redeemGiftCardAction,
} from '@/lib/actions';
import type { Wallet } from '@/lib/queries';

interface WalletViewProps {
  wallet: Wallet;
  locale: Locale;
  currency: string;
  dict: Dictionary;
}

const AMOUNTS = [2500, 5000, 10000];
const DESIGNS = [0, 1, 2];

/** Wallet balance, gift card redeem/buy, and payment methods. */
export function WalletView({ wallet, locale, currency, dict }: WalletViewProps): React.JSX.Element {
  const t = dict.wallet;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = (): void => router.refresh();

  // Redeem
  const [code, setCode] = useState('');
  const [redeemErr, setRedeemErr] = useState<string | null>(null);

  // Buy gift card modal
  const [buyOpen, setBuyOpen] = useState(false);
  const [amount, setAmount] = useState(5000);
  const [design, setDesign] = useState(0);
  const [toName, setToName] = useState('');
  const [fromName, setFromName] = useState('');
  const [message, setMessage] = useState('');
  const [buyErr, setBuyErr] = useState<string | null>(null);

  // Add card modal
  const [cardOpen, setCardOpen] = useState(false);
  const [cardNum, setCardNum] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cardErr, setCardErr] = useState<string | null>(null);

  const [pending, setPending] = useState(false);

  const redeem = (e: React.FormEvent): void => {
    e.preventDefault();
    setRedeemErr(null);
    startTransition(async () => {
      const res = await redeemGiftCardAction(code);
      if (res.ok) {
        setCode('');
        refresh();
      } else setRedeemErr(t.error);
    });
  };

  const buy = (): void => {
    setBuyErr(null);
    setPending(true);
    startTransition(async () => {
      const res = await buyGiftCardAction({
        amountCents: amount,
        design,
        toName: toName || null,
        fromName: fromName || null,
        message: message || null,
      });
      setPending(false);
      if (res.ok) {
        setBuyOpen(false);
        setToName('');
        setFromName('');
        setMessage('');
        refresh();
      } else setBuyErr(t.error);
    });
  };

  const addCard = (): void => {
    setCardErr(null);
    const digits = cardNum.replace(/\D/g, '');
    if (digits.length < 4 || !expMonth || !expYear) {
      setCardErr(t.error);
      return;
    }
    setPending(true);
    startTransition(async () => {
      const res = await addPaymentMethodAction(
        'visa',
        digits.slice(-4),
        Number(expMonth),
        Number(expYear),
      );
      setPending(false);
      if (res.ok) {
        setCardOpen(false);
        setCardNum('');
        setExpMonth('');
        setExpYear('');
        refresh();
      } else setCardErr(t.error);
    });
  };

  return (
    <div className="wallet">
      <Card className="balance-card">
        <span className="balance-card__label">{t.balance}</span>
        <span className="balance-card__amount">
          <Price cents={wallet.balanceCents} currency={currency} locale={locale} />
        </span>
        <form className="redeem-form" onSubmit={redeem}>
          <input
            className="discover-filters__search"
            placeholder={t.redeemPlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label={t.redeemTitle}
          />
          <Button type="submit" disabled={!code}>
            {t.redeem}
          </Button>
        </form>
        {redeemErr && <p className="booking__error">{redeemErr}</p>}
      </Card>

      <section className="home-section">
        <div className="home-section__head">
          <h2 className="home-section__title">{t.giftCardsTitle}</h2>
          <button type="button" className="home-section__more" onClick={() => setBuyOpen(true)}>
            {t.buy}
          </button>
        </div>
        {wallet.giftCards.length > 0 ? (
          <div className="giftcard-grid">
            {wallet.giftCards.map((gc) => (
              <Card key={gc.id} className={`giftcard giftcard--d${gc.design}`}>
                <span className="giftcard__amount">
                  <Price cents={gc.balanceCents} currency={currency} locale={locale} />
                </span>
                <span className="giftcard__code">{gc.code}</span>
                {gc.fromName && (
                  <span className="giftcard__from">
                    {interpolate(t.giftCardFrom, { name: gc.fromName })}
                  </span>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <p className="profile__muted">{t.noGiftCards}</p>
        )}
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <h2 className="home-section__title">{t.paymentMethodsTitle}</h2>
          <button type="button" className="home-section__more" onClick={() => setCardOpen(true)}>
            {t.addCard}
          </button>
        </div>
        {wallet.paymentMethods.length > 0 ? (
          <ul className="card-list">
            {wallet.paymentMethods.map((pm) => (
              <li key={pm.id}>
                <Card className="payment-row">
                  <span className="payment-row__brand">
                    {interpolate(t.cardEnding, { brand: pm.brand, last4: pm.last4 })}
                  </span>
                  <span className="payment-row__exp">
                    {interpolate(t.expires, {
                      month: String(pm.expMonth).padStart(2, '0'),
                      year: String(pm.expYear),
                    })}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile__muted">{t.noCards}</p>
        )}
      </section>

      {/* Buy gift card */}
      <Modal open={buyOpen} onClose={() => setBuyOpen(false)} title={t.buyTitle}>
        <div className="dialog">
          <p className="profile__muted">{t.buySubtitle}</p>
          <div className="field">
            <span>{t.amount}</span>
            <div className="chip-row">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="wizard__chip"
                  data-active={amount === a}
                  onClick={() => setAmount(a)}
                >
                  <Price cents={a} currency={currency} locale={locale} />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>{t.design}</span>
            <div className="chip-row">
              {DESIGNS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`giftcard-swatch giftcard--d${d}`}
                  data-active={design === d}
                  aria-label={`${t.design} ${d + 1}`}
                  onClick={() => setDesign(d)}
                />
              ))}
            </div>
          </div>
          <label className="field">
            <span>{t.toLabel}</span>
            <input value={toName} onChange={(e) => setToName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.fromLabel}</span>
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.messageLabel}</span>
            <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {buyErr && <p className="booking__error">{buyErr}</p>}
          <Button block onClick={buy} disabled={pending}>
            {interpolate(t.pay, {
              amount: new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
                amount / 100,
              ),
            })}
          </Button>
        </div>
      </Modal>

      {/* Add card */}
      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title={t.addCard}>
        <div className="dialog">
          <label className="field">
            <span>{t.addCard}</span>
            <input
              inputMode="numeric"
              placeholder="•••• •••• •••• 4242"
              value={cardNum}
              onChange={(e) => setCardNum(e.target.value)}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>MM</span>
              <input
                inputMode="numeric"
                placeholder="08"
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value)}
              />
            </label>
            <label className="field">
              <span>YYYY</span>
              <input
                inputMode="numeric"
                placeholder="2027"
                value={expYear}
                onChange={(e) => setExpYear(e.target.value)}
              />
            </label>
          </div>
          {cardErr && <p className="booking__error">{cardErr}</p>}
          <Button block onClick={addCard} disabled={pending}>
            {t.addCard}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
