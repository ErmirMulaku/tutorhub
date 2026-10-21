import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { UiActions, uiFeature } from '../core/ui/ui.store';
import { ToastHost } from '../shared/toast';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Port of app/AppShell.tsx: the authenticated layout (sidebar + topbar +
 * routed content). The auth check itself moved to `authGuard` on the route.
 */
@Component({
  selector: 'th-shell',
  imports: [RouterOutlet, Sidebar, Topbar, ToastHost],
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
    </div>
    <th-toast-host />
  `,
})
export class Shell {
  private readonly store = inject(Store);
  protected readonly sidebarOpen = this.store.selectSignal(uiFeature.selectSidebarOpen);

  constructor() {
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
