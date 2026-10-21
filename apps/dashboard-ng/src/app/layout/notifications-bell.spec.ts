import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { TutorNotification } from '../core/api/models';
import { DashboardActions, dashboardFeature } from '../core/dashboard/dashboard.store';
import { NotificationsBell, ago } from './notifications-bell';

const NOW = Date.parse('2026-10-21T12:00:00.000Z');
const minutesAgo = (m: number): string => new Date(NOW - m * 60_000).toISOString();

describe('ago()', () => {
  it('prints minutes, hours, then days — never "0m"', () => {
    expect(ago(minutesAgo(0), NOW)).toBe('1m');
    expect(ago(minutesAgo(5), NOW)).toBe('5m');
    expect(ago(minutesAgo(180), NOW)).toBe('3h');
    expect(ago(minutesAgo(60 * 24 * 2), NOW)).toBe('2d');
  });
});

/**
 * MockStore stands in for the real NgRx store: `overrideSelector` decides what
 * the component reads, and a `dispatch` spy records what it asks for — no
 * reducers or effects involved.
 */
describe('NotificationsBell', () => {
  let fixture: ComponentFixture<NotificationsBell>;
  let store: MockStore;

  const feed: TutorNotification[] = [
    {
      id: 'n1',
      type: 'booking',
      title: 'Mia Chen requested a lesson',
      detail: 'Mathematics',
      createdAt: minutesAgo(5),
    },
    { id: 'n2', type: 'review', title: 'New 5★ review', detail: null, createdAt: minutesAgo(90) },
  ];
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bell = (): HTMLButtonElement => el().querySelector('button[aria-label="Notifications"]')!;

  async function create(notifications: TutorNotification[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NotificationsBell],
      providers: [provideMockStore()],
    });
    store = TestBed.inject<MockStore<object>>(MockStore);
    store.overrideSelector(dashboardFeature.selectNotifications, notifications);
    spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(NotificationsBell);
    document.body.appendChild(el());
    await fixture.whenStable();
  }

  afterEach(() => el().remove());

  it('asks for the feed as soon as it appears', async () => {
    await create([]);
    expect(store.dispatch).toHaveBeenCalledWith(DashboardActions.loadNotifications());
  });

  it('shows a dot only when there is something new', async () => {
    await create(feed);
    expect(el().querySelector('.topbar__bell-dot')).not.toBeNull();
  });

  it('opens a panel listing each item with its type colour and age', async () => {
    await create(feed);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    bell().click();
    await fixture.whenStable();
    jasmine.clock().uninstall();

    expect(bell().getAttribute('aria-expanded')).toBe('true');
    const items = [...el().querySelectorAll('.notif__item')];
    expect(items.map((i) => i.querySelector('.notif__title')?.textContent)).toEqual([
      'Mia Chen requested a lesson',
      'New 5★ review',
    ]);
    expect(items[0]?.querySelector('.notif__dot')?.classList).toContain('notif__dot--warn');
    expect(items[1]?.querySelector('.notif__dot')?.classList).toContain('notif__dot--star');
    expect(items[0]?.querySelector('.notif__time')?.textContent?.trim()).toBe('5m');
  });

  it('says "all caught up" when the feed is empty', async () => {
    await create([]);
    bell().click();
    await fixture.whenStable();
    expect(el().querySelector('.topbar__bell-dot')).toBeNull();
    expect(el().querySelector('.notif__empty')?.textContent).toContain("You're all caught up.");
  });

  it('stays open for clicks inside, closes on a click anywhere else', async () => {
    await create(feed);
    bell().click();
    await fixture.whenStable();

    el()
      .querySelector('.notif__panel')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await fixture.whenStable();
    expect(el().querySelector('.notif__panel')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await fixture.whenStable();
    expect(el().querySelector('.notif__panel')).toBeNull();
  });
});
