import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { Card, ErrorState } from '@ermulaku/dashboard-kit';

/** Reloads the page; a token so specs can replace it. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).location;
    return () => location.reload();
  },
});

/**
 * Shown, inside the normal layout, in place of a page served by a remote that
 * couldn't be loaded (see `remoteRoutes`).
 *
 * Retry first navigates to the same URL again, which re-runs the remote
 * route's `canMatch` and so the load — enough when the remote was down when
 * the app started. If this fallback is still on screen afterwards, it reloads
 * the page: a module whose fetch failed stays failed in the module loader
 * (es-module-shims) for the life of the page, with no public way to retry it.
 */
@Component({
  selector: 'th-remote-unavailable',
  imports: [Card, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<th-card><th-error-state [message]="message()" (retry)="retry()" /></th-card>`,
})
export class RemoteUnavailable {
  private readonly router = inject(Router);
  private readonly reloadPage = inject(RELOAD_PAGE);
  private destroyed = false;

  /** The page's name, from the route's `data` (component input binding). */
  readonly label = input('This page');
  protected readonly message = computed(() => `${this.label()} is temporarily unavailable.`);

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  protected async retry(): Promise<void> {
    await this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
    // The remote's route replaced this one: it loaded.
    if (this.destroyed) return;
    this.reloadPage();
  }
}
