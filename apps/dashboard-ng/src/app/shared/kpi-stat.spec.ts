import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KPI_CARD_HEIGHT, KpiStat } from './kpi-stat';
import { Skeleton } from './skeleton';

@Component({
  imports: [KpiStat, Skeleton],
  template: `
    <div class="kpi-row">
      <th-kpi-stat icon="calendar" label="Lessons today" value="3" />
      <th-kpi-stat
        icon="bell"
        label="Pending requests"
        value="2"
        [delta]="{ text: 'Action needed', tone: 'danger' }"
      />
      <th-skeleton [height]="height" />
    </div>
  `,
})
class Row {
  readonly height = KPI_CARD_HEIGHT;
}

/**
 * A layout-stability guard: the dashboard shows KPI_CARD_HEIGHT-tall skeletons
 * while the numbers load, so a loaded card must be exactly that tall or the
 * page jumps (Lighthouse's CLS). This runs with the app's real global styles —
 * and in Karma's fallback font, since Google Fonts isn't loaded here, which is
 * exactly the case the fixed line boxes in styles/_overrides.scss are for.
 */
describe('KPI card height', () => {
  it('matches the loading skeleton, with or without a delta pill', async () => {
    const fixture = TestBed.createComponent(Row);
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el); // real layout needs the DOM
    await fixture.whenStable();

    const heights = [...el.querySelectorAll('.kpi-row > *')].map((e) =>
      Math.round(e.getBoundingClientRect().height),
    );
    el.remove();
    expect(heights).toEqual([KPI_CARD_HEIGHT, KPI_CARD_HEIGHT, KPI_CARD_HEIGHT]);
  });
});
