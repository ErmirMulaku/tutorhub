import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { ReviewsApi } from '../../core/api/reviews-api';
import { bookingsFeature } from '../../core/bookings/bookings.store';
import { dashboardFeature } from '../../core/dashboard/dashboard.store';
import { KPI_CARD_HEIGHT } from '../../shared/kpi-stat';
import { DashboardPage } from './dashboard-page';

/** The two layout-stability fixes on the dashboard (gaps found by Lighthouse in both apps). */
describe('DashboardPage loading states', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let store: MockStore;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear(); // the banner's "dismissed" flag
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideMockStore(),
        { provide: ReviewsApi, useValue: { myReviews: () => of([]) } },
      ],
    });
    store = TestBed.inject<MockStore<object>>(MockStore);
    store.overrideSelector(dashboardFeature.selectSummary, null); // KPIs still loading
    store.overrideSelector(dashboardFeature.selectSummaryError, null);
    store.overrideSelector(dashboardFeature.selectMe, null);
    store.overrideSelector(dashboardFeature.selectPublished, null);
    store.overrideSelector(bookingsFeature.selectToday, []);
    store.overrideSelector(bookingsFeature.selectTodayStatus, 'loading');
    fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
  });

  // overrideSelector patches the shared selector itself — undo it, or it leaks into later specs.
  afterEach(() => store.resetSelectors());

  async function setPublished(value: boolean | null): Promise<void> {
    store.overrideSelector(dashboardFeature.selectPublished, value);
    store.refreshState();
    await fixture.whenStable();
  }

  it('shows no setup banner while the published flag is still unknown', async () => {
    // React treated "unknown" as "not published": the banner flashed for
    // published tutors and everything below it jumped when it vanished.
    expect(el().querySelector('.setup-banner')).toBeNull();
    await setPublished(true);
    expect(el().querySelector('.setup-banner')).toBeNull();
  });

  it('shows the banner once the tutor is known to be unpublished', async () => {
    await setPublished(false);
    expect(el().querySelector('.setup-banner')).not.toBeNull();
  });

  it('reserves the KPI cards’ height with its loading skeletons', () => {
    const skeletons = [...el().querySelectorAll<HTMLElement>('.kpi-row > th-skeleton')];
    expect(skeletons.length).toBe(4);
    for (const s of skeletons) expect(s.style.blockSize).toBe(`${String(KPI_CARD_HEIGHT)}px`);
  });
});
