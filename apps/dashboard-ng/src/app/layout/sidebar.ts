import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, of } from 'rxjs';
import { ProfileService } from '../core/api/profile.service';
import { AuthActions } from '../core/auth/auth.store';
import { NAV_GROUPS } from '../core/nav';
import { Avatar } from '../shared/avatar';

/**
 * Port of components/Sidebar.tsx. Live badge counts (pending / unread) come
 * with the dashboard summary in Phase 3.
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
  private readonly profile = inject(ProfileService);

  protected readonly groups = NAV_GROUPS;

  // toSignal subscribes once and exposes the latest value as a signal. Errors
  // are caught first: a signal that holds an error re-throws when read.
  protected readonly me = toSignal(this.profile.meTutor().pipe(catchError(() => of(null))), {
    initialValue: null,
  });
  protected readonly published = toSignal(
    this.profile.isPublished().pipe(catchError(() => of(false))),
    { initialValue: false },
  );

  protected signOut(): void {
    // The auth effect clears storage and navigates to /login.
    this.store.dispatch(AuthActions.clearCredentials());
  }
}
