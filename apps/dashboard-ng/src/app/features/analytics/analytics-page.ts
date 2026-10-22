import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { cachedQuery } from '../../core/api/cache-tags';
import { type AreaPoint, AreaChart } from '../../shared/area-chart';
import { type Bar, BarChart } from '../../shared/bar-chart';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { Skeleton } from '../../shared/skeleton';

/** Port of features/analytics/AnalyticsScreen.tsx — KPIs, trend, top subjects, weekday load, mix. */
@Component({
  selector: 'th-analytics-page',
  imports: [AreaChart, BarChart, Card, ErrorState, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary.data(); as s) {
      <div class="analytics">
        <div class="kpi-row">
          <th-card class="earn__stat">
            <div class="earn__stat-label">Lessons this month</div>
            <div class="earn__stat-value">{{ s.lessonsThisMonth }}</div>
          </th-card>
          <th-card class="earn__stat">
            <div class="earn__stat-label">New students</div>
            <div class="earn__stat-value">{{ s.newStudents }}</div>
          </th-card>
          <th-card class="earn__stat">
            <div class="earn__stat-label">Repeat rate</div>
            <div class="earn__stat-value">{{ s.repeatRatePct }}%</div>
          </th-card>
          <th-card class="earn__stat">
            <div class="earn__stat-label">Utilization</div>
            <div class="earn__stat-value">{{ s.utilizationPct }}%</div>
          </th-card>
        </div>

        <div class="analytics__row">
          <th-card>
            <h3 class="card-head__title">Lessons over time</h3>
            @if (overTimePoints(); as points) {
              <svg th-area-chart [points]="points"></svg>
            }
          </th-card>
          <th-card>
            <h3 class="card-head__title">Top subjects</h3>
            <div class="topsubs">
              @for (sub of topSubjects.data() ?? []; track sub.name) {
                <div class="topsubs__row">
                  <span class="topsubs__name">{{ sub.name }}</span>
                  <div class="topsubs__track">
                    <div class="topsubs__fill" [style.width.%]="sub.pct"></div>
                  </div>
                  <span class="muted topsubs__pct">{{ sub.pct }}%</span>
                </div>
              }
            </div>
          </th-card>
        </div>

        <div class="analytics__row">
          <th-card>
            <h3 class="card-head__title">Lessons by day of week</h3>
            @if (byDayBars(); as bars) {
              <th-bar-chart [bars]="bars" />
            }
          </th-card>
          <th-card>
            <h3 class="card-head__title">Student mix</h3>
            @if (mix.data(); as m) {
              <div class="splitbar">
                <div
                  class="splitbar__seg splitbar__seg--ret"
                  [style.width.%]="m.returningPct"
                ></div>
                <div class="splitbar__seg splitbar__seg--new" [style.width.%]="m.newPct"></div>
              </div>
              <div class="splitbar__legend">
                <span
                  ><i class="splitbar__dot splitbar__dot--ret"></i> Returning
                  {{ m.returningPct }}%</span
                >
                <span><i class="splitbar__dot splitbar__dot--new"></i> New {{ m.newPct }}%</span>
              </div>
            }
          </th-card>
        </div>
      </div>
    } @else if (summary.error()) {
      <th-error-state message="Could not load your analytics." (retry)="summary.reload()" />
    } @else {
      <th-skeleton [height]="320" />
    }
  `,
})
export class AnalyticsPage {
  private readonly api = inject(AnalyticsApi);

  // Five independent read-only aggregates, all under the 'Analytics' tag —
  // React's five query hooks. Nothing in the dashboard invalidates it today.
  protected readonly summary = cachedQuery({ tags: ['Analytics'], load: () => this.api.summary() });
  private readonly overTime = cachedQuery({
    tags: ['Analytics'],
    load: () => this.api.lessonsOverTime(),
  });
  protected readonly topSubjects = cachedQuery({
    tags: ['Analytics'],
    load: () => this.api.topSubjects(),
  });
  private readonly byDay = cachedQuery({
    tags: ['Analytics'],
    load: () => this.api.lessonsByDayOfWeek(),
  });
  protected readonly mix = cachedQuery({ tags: ['Analytics'], load: () => this.api.studentMix() });

  protected readonly overTimePoints = computed<AreaPoint[] | undefined>(() =>
    this.overTime.data()?.map((m) => ({ label: m.month, value: m.count })),
  );
  protected readonly byDayBars = computed<Bar[] | undefined>(() =>
    this.byDay.data()?.map((d) => ({ label: d.day, value: d.count })),
  );
}
