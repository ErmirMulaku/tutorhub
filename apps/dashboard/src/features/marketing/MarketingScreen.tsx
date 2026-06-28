import { type FormEvent, type JSX, useState } from 'react';
import { Button, Card, Modal, Skeleton } from '@ermulaku/ui';
import {
  type CreatePromotionInput,
  type Promotion,
  type PromotionState,
  useCreatePromotionMutation,
  useEndPromotionMutation,
  useGetMarketingSummaryQuery,
  useGetPromotionsQuery,
  useGetReferralProgramQuery,
} from '../../store/api';
import { CodeChip } from '../../components/CodeChip';
import { useToast } from '../../components/ToastProvider';
import { money } from '../../lib/format';

const STATE_TONE: Record<PromotionState, string> = {
  ACTIVE: 'th-pill--success',
  SCHEDULED: 'th-pill--warn',
  ENDED: '',
};
const STATE_LABEL: Record<PromotionState, string> = {
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  ENDED: 'Ended',
};

const EMPTY: CreatePromotionInput = {
  name: '',
  code: '',
  discountType: 'PERCENT',
  discountValue: 15,
};

function PromoCard({ promo }: { promo: Promotion }): JSX.Element {
  const [end] = useEndPromotionMutation();
  const toast = useToast();
  const discount =
    promo.discountType === 'PERCENT' ? `${promo.discountValue}% off` : `${money(promo.discountValue)} off`;
  return (
    <Card className="promo">
      <div className="promo__head">
        <h3 className="promo__name">{promo.name}</h3>
        <span className={`th-pill ${STATE_TONE[promo.state]}`}>{STATE_LABEL[promo.state]}</span>
      </div>
      <div className="promo__discount">{discount}</div>
      <CodeChip code={promo.code} />
      <div className="promo__foot muted">
        <span>{promo.redemptions} redeemed</span>
        {promo.state !== 'ENDED' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void end(promo.id)
                .unwrap()
                .then(() => toast('Promotion ended'));
            }}
          >
            End
          </Button>
        )}
      </div>
    </Card>
  );
}

export function MarketingScreen(): JSX.Element {
  const { data: summary, isLoading } = useGetMarketingSummaryQuery();
  const { data: promotions } = useGetPromotionsQuery();
  const { data: referral } = useGetReferralProgramQuery();
  const [create, { isLoading: creating }] = useCreatePromotionMutation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreatePromotionInput>(EMPTY);
  const toast = useToast();

  function submit(e: FormEvent): void {
    e.preventDefault();
    void create(form)
      .unwrap()
      .then(() => {
        toast('Promotion created');
        setOpen(false);
        setForm(EMPTY);
      });
  }

  if (isLoading || !summary) return <Skeleton height={320} />;

  return (
    <div className="mkt">
      <div className="mkt__stats">
        <Card className="earn__stat">
          <div className="earn__stat-label">Active promotions</div>
          <div className="earn__stat-value">{summary.activePromotions}</div>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">Redemptions</div>
          <div className="earn__stat-value">{summary.redemptions}</div>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">Gift cards sold</div>
          <div className="earn__stat-value">{money(summary.giftCardsSoldCents)}</div>
        </Card>
      </div>

      <div className="card-head">
        <h3>Promotions</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          New promotion
        </Button>
      </div>
      <div className="mkt__promos">{promotions?.map((p) => <PromoCard key={p.id} promo={p} />)}</div>

      <div className="mkt__bottom">
        <Card className="mkt__gift">
          <h3 className="card-head__title">Gift cards</h3>
          <p>Let students buy gift cards toward your lessons.</p>
          <div className="mkt__gift-value">{money(summary.giftCardsSoldCents)} sold</div>
        </Card>
        {referral && (
          <Card>
            <h3 className="card-head__title">Referral program</h3>
            <p className="muted">
              {money(referral.creditCents)} credit each, for you and a friend.
            </p>
            <div className="mkt__referral">
              <div>
                <div className="mkt__referral-num">{referral.referredCount}</div>
                <div className="muted">referred</div>
              </div>
              <div>
                <div className="mkt__referral-num">{money(referral.issuedCents)}</div>
                <div className="muted">issued</div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New promotion">
        <form className="svc-form" onSubmit={submit}>
          <label className="login__field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="login__field">
            <span>Code</span>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </label>
          <div className="svc-form__row">
            <label className="login__field">
              <span>Type</span>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({ ...form, discountType: e.target.value as CreatePromotionInput['discountType'] })
                }
              >
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed (USD)</option>
              </select>
            </label>
            <label className="login__field">
              <span>{form.discountType === 'PERCENT' ? 'Percent off' : 'Amount off (USD)'}</span>
              <input
                type="number"
                min={1}
                value={form.discountType === 'PERCENT' ? form.discountValue : form.discountValue / 100}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountValue:
                      form.discountType === 'PERCENT'
                        ? Number(e.target.value)
                        : Number(e.target.value) * 100,
                  })
                }
              />
            </label>
          </div>
          <Button type="submit" block disabled={creating}>
            {creating ? 'Creating…' : 'Create promotion'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
