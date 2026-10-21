import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { authFeature } from '../core/auth/auth.store';
import { BookingsActions } from '../core/bookings/bookings.store';
import { LiveSocketService } from '../core/live/live-socket.service';
import { UiActions, uiFeature } from '../core/ui/ui.store';
import { NewLessonModal } from '../features/lessons/new-lesson-modal';
import { ToastHost } from '../shared/toast';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Port of app/AppShell.tsx: the authenticated layout (sidebar + topbar +
 * routed content). The auth check itself moved to `authGuard` on the route.
 */
@Component({
  selector: 'th-shell',
  imports: [RouterOutlet, Sidebar, Topbar, ToastHost, NewLessonModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.shell--drawer-open]="sidebarOpen()">
      <aside th-sidebar></aside>
      <button
        type="button"
        class="shell__backdrop"
        aria-label="Close menu"
        (click)="closeDrawer()"
      ></button>
      <div class="shell__main">
        <header th-topbar></header>
        <main class="shell__content">
          <router-outlet />
        </main>
      </div>
      <th-new-lesson-modal />
    </div>
    <th-toast-host />
  `,
})
export class Shell {
  private readonly store = inject(Store);
  protected readonly sidebarOpen = this.store.selectSignal(uiFeature.selectSidebarOpen);

  constructor() {
    // Port of useLiveBookings in AppShell: one Socket.IO connection for as
    // long as the shell is on screen (i.e. while signed in). Each pushed
    // change becomes an NgRx action; takeUntilDestroyed closes the socket.
    const tutorId = this.store.selectSignal(authFeature.selectTutorId)();
    if (tutorId !== null) {
      inject(LiveSocketService)
        .bookingChanges(tutorId)
        .pipe(takeUntilDestroyed())
        .subscribe((change) => this.store.dispatch(BookingsActions.liveChanged({ change })));
    }

    // Close the mobile drawer whenever the route changes. takeUntilDestroyed
    // unsubscribes when the shell is destroyed (React: the effect's cleanup).
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeDrawer());
  }

  protected closeDrawer(): void {
    this.store.dispatch(UiActions.setSidebarOpen({ open: false }));
  }
}
