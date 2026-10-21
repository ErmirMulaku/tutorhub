import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { uiFeature } from './core/ui/ui.store';

/** Root component: hosts the router and reflects theme/accent onto <html>. */
@Component({
  selector: 'th-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const store = inject(Store);
    const theme = store.selectSignal(uiFeature.selectTheme);
    const accent = store.selectSignal(uiFeature.selectAccent);
    const root = inject(DOCUMENT).documentElement;

    // Port of use-theme.ts. An effect re-runs whenever a signal it read
    // changes — like useEffect with [theme, accent] as dependencies, but the
    // dependencies are tracked automatically.
    effect(() => {
      root.dataset['theme'] = theme();
      root.dataset['accent'] = accent();
    });
  }
}
