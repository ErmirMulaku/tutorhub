import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { loadOnTags } from '../core/api/cache-tags';
import { AuthActions } from '../core/auth/auth.store';
import { DashboardActions, dashboardFeature } from '../core/dashboard/dashboard.store';
import { type NavItem, NAV_GROUPS } from '../core/nav';
import { Avatar } from '../shared/avatar';

type Badge = NonNullable<NavItem['badge']>;

/**
 * Port of components/Sidebar.tsx. The sidebar is on every shell page, so it's
 * the one that keeps the shared tutor data loaded (name, KPI summary for the
 * badges, published flag); the dashboard screen reads the same store slice
 * instead of fetching again.
 */
@Component({
  selector: 'aside[th-sidebar]',
  imports: [RouterLink, RouterLinkActive, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sidebar' },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(Store);

  protected readonly groups = NAV_GROUPS;
  protected readonly me = this.store.selectSignal(dashboardFeature.selectMe);
  protected readonly published = this.store.selectSignal(dashboardFeature.selectPublished);
  private readonly summary = this.store.selectSignal(dashboardFeature.selectSummary);

  constructor() {
    loadOnTags(['MeTutor'], () => DashboardActions.loadMe());
    loadOnTags(['DashboardSummary'], () => DashboardActions.loadSummary());
    loadOnTags(['Settings'], () => DashboardActions.loadPublished());
  }

  /** Live badge counts that aren't part of the static nav model. */
  protected badgeFor(item: NavItem): Badge | undefined {
    const summary = this.summary();
    if (item.to === '/lessons' && summary && summary.pendingCount > 0)
      return { count: summary.pendingCount, tone: 'primary' };
    if (item.to === '/messages' && summary && summary.unreadMessages > 0)
      return { count: summary.unreadMessages, tone: 'danger' };
    return item.badge;
  }

  protected signOut(): void {
    // The auth effect clears storage and navigates to /login.
    this.store.dispatch(AuthActions.clearCredentials());
  }
}
