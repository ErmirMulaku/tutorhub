import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

/** Root component. Phase 1 placeholder; the shell + routes arrive in Phase 2. */
@Component({
  selector: 'th-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <div class="login__panel">
        <div class="login__brand">
          Tutor<strong>Hub</strong> <span class="login__eyebrow">FOR TUTORS</span>
        </div>
        <h1 class="login__title">Angular dashboard</h1>
        <p class="login__subtitle">Scaffold ready. Talking to {{ apiUrl }}.</p>
      </div>
    </div>
    <router-outlet />
  `,
})
export class App {
  protected readonly apiUrl = environment.apiUrl;
}
