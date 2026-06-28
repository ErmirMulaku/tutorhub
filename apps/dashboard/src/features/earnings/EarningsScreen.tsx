import type { JSX } from 'react';
import { Button, Card, Skeleton } from '@ermulaku/ui';
import {
  type Transaction,
  useGetEarningsByMonthQuery,
  useGetEarningsSummaryQuery,
  useGetTransactionsQuery,
  useWithdrawMutation,
} from '../../store/api';
import { BarChart } from '../../components/BarChart';
import { useToast } from '../../components/ToastProvider';
import { dayOf, money } from '../../lib/format';

function exportCsv(rows: Transaction[]): void {
  const header = 'Date,Student,Subject,Net,Fee,Status';
  const body = rows
    .map(
      (r) =>
        `${new Date(r.date).toISOString().slice(0, 10)},${r.studentName},${r.subjectName},${(r.netCents / 100).toFixed(2)},${(r.feeCents / 100).toFixed(2)},${r.status}`,
    )
    .join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function EarningsScreen(): JSX.Element {
  const { data: summary, isLoading } = useGetEarningsSummaryQuery();
  const { data: byMonth } = useGetEarningsByMonthQuery();
  const { data: transactions } = useGetTransactionsQuery();
  const [withdraw, { isLoading: withdrawing }] = useWithdrawMutation();
  const toast = useToast();

  if (isLoading || !summary) return <Skeleton height={320} />;

  return (
    <div className="earn">
      <div className="earn__top">
        <Card className="earn__balance">
          <div className="earn__balance-label">Available to withdraw</div>
          <div className="earn__balance-value">{money(summary.availableCents)}</div>
          <div className="earn__balance-meta">
            Next auto-payout · {summary.payoutSchedule.toLowerCase()}
          </div>
          <Button
            size="sm"
            disabled={withdrawing || summary.availableCents === 0}
            onClick={() => {
              void withdraw()
                .unwrap()
                .then(() => toast('Withdrawal on its way 🎉'));
            }}
          >
            Withdraw now
          </Button>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">Pending clearance</div>
          <div className="earn__stat-value">{money(summary.pendingCents)}</div>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">Lifetime earnings</div>
          <div className="earn__stat-value">{money(summary.lifetimeCents)}</div>
        </Card>
      </div>

      <div className="earn__mid">
        <Card>
          <h3 className="card-head__title">Earnings · last 8 months</h3>
          {byMonth && (
            <BarChart
              bars={byMonth.map((m, i) => ({
                label: m.month,
                value: m.netCents,
                highlight: i === byMonth.length - 1,
              }))}
              format={(v) => money(v)}
            />
          )}
        </Card>
        <Card className="earn__payout">
          <h3 className="card-head__title">Payout method</h3>
          <div className="earn__method">{summary.payoutMethod ?? 'No method on file'}</div>
          <p className="muted">
            Auto-payout runs {summary.payoutSchedule.toLowerCase()} to your linked card.
          </p>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <h3>Recent transactions</h3>
          <Button size="sm" variant="secondary" onClick={() => transactions && exportCsv(transactions)}>
            Export CSV
          </Button>
        </div>
        <table className="txn">
          <thead>
            <tr>
              <th>Date</th>
              <th>Lesson</th>
              <th>Net</th>
              <th>Fee</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions?.map((t) => (
              <tr key={t.id}>
                <td>{dayOf(t.date)}</td>
                <td>
                  {t.studentName} · {t.subjectName}
                </td>
                <td className="txn__net">+{money(t.netCents)}</td>
                <td className="muted">−{money(t.feeCents)}</td>
                <td>
                  <span className={`th-pill${t.status === 'PAID' ? ' th-pill--info' : ''}`}>
                    {t.status === 'PAID' ? 'Paid out' : 'Clearing'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
