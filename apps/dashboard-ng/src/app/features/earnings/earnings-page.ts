import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { cachedQuery } from '../../core/api/cache-tags';
import { EarningsApi } from '../../core/api/earnings-api';
import { errorMessage } from '../../core/api/errors';
import { dayOf, money } from '../../core/format';
import { type Bar, BarChart } from '../../shared/bar-chart';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';
import { ConnectPayouts } from './payout-editor';
import { transactionsCsv } from './transactions-csv';

/** Port of features/earnings/EarningsScreen.tsx — balance, monthly chart, payouts, history. */
@Component({
  selector: 'th-earnings-page',
  imports: [BarChart, Button, Card, ConnectPayouts, ErrorState, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './earnings-page.html',
})
export class EarningsPage {
  private readonly api = inject(EarningsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  // Three independent requests, each under the 'Earnings' tag (a withdrawal
  // invalidates it, so all three refresh) — React's three query hooks.
  protected readonly summary = cachedQuery({ tags: ['Earnings'], load: () => this.api.summary() });
  private readonly byMonth = cachedQuery({ tags: ['Earnings'], load: () => this.api.byMonth() });
  protected readonly transactions = cachedQuery({
    tags: ['Earnings'],
    load: () => this.api.transactions(),
  });

  /** The last bar (the current month) is highlighted. */
  protected readonly bars = computed<Bar[] | undefined>(() => {
    const months = this.byMonth.data();
    return months?.map((m, i) => ({
      label: m.month,
      value: m.netCents,
      highlight: i === months.length - 1,
    }));
  });
  protected readonly withdrawing = signal(false);

  protected readonly money = money;
  protected readonly dayOf = dayOf;

  protected withdraw(): void {
    this.withdrawing.set(true);
    this.api
      .withdraw()
      .pipe(
        finalize(() => this.withdrawing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.toast.show('Withdrawal on its way 🎉'),
        error: (err: unknown) => this.toast.show(`Could not withdraw: ${errorMessage(err)}`),
      });
  }

  protected exportCsv(): void {
    const rows = this.transactions.data();
    if (!rows) return;
    const blob = new Blob([transactionsCsv(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
