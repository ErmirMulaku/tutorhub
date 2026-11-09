import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from '@ermulaku/dashboard-kit';

/**
 * Root component for standalone mode only (see app.config.ts). The dashboard
 * never renders it: it loads `REVIEWS_ROUTES`, not this app.
 */
@Component({
  selector: 'th-root',
  imports: [RouterOutlet, ToastHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .standalone-banner {
      padding: 10px 16px;
      background: var(--warn-tint);
      color: var(--warn-ink);
      font-size: 13.5px;
      font-weight: 600;
      text-align: center;
    }
    .standalone-main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px;
    }
  `,
  template: `
    <div class="standalone-banner" role="status">
      Standalone mode — open through the dashboard (:3100) to sign in
    </div>
    <main class="standalone-main"><router-outlet /></main>
    <th-toast-host />
  `,
})
export class App {}
