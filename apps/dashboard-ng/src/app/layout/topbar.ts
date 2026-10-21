import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map } from 'rxjs';
import { PAGE_META } from '../core/nav';
import { type Accent, UiActions, uiFeature } from '../core/ui/ui.store';
import { Button } from '../shared/button';
import { Icon } from '../shared/icon';
import { NotificationsBell } from './notifications-bell';

const ACCENTS: { key: Accent; label: string; swatch: string }[] = [
  { key: 'teal', label: 'Teal', swatch: '#0e8f8a' },
  { key: 'indigo', label: 'Indigo', swatch: '#4f56d6' },
  { key: 'plum', label: 'Plum', swatch: '#8b46c9' },
];

/** Port of components/Topbar.tsx. */
@Component({
  selector: 'header[th-topbar]',
  imports: [Button, Icon, NotificationsBell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'topbar' },
  templateUrl: './topbar.html',
})
export class Topbar {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly accents = ACCENTS;
  // useAppSelector(s => s.ui.theme)  →  store.selectSignal(selector)
  protected readonly theme = this.store.selectSignal(uiFeature.selectTheme);
  protected readonly accent = this.store.selectSignal(uiFeature.selectAccent);
  protected readonly online = this.store.selectSignal(uiFeature.selectOnline);
  protected readonly query = signal('');

  // useLocation().pathname as a signal: the URL after each completed navigation.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly meta = computed(
    () => PAGE_META[this.url().split('?')[0] ?? ''] ?? { title: 'Dashboard', subtitle: '' },
  );

  protected onSearch(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();
    if (q !== '') void this.router.navigate(['/lessons'], { queryParams: { q } });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggleSidebar(): void {
    this.store.dispatch(UiActions.toggleSidebar());
  }
  protected toggleOnline(): void {
    this.store.dispatch(UiActions.setOnline({ online: !this.online() }));
  }
  protected setAccent(accent: Accent): void {
    this.store.dispatch(UiActions.setAccent({ accent }));
  }
  protected toggleTheme(): void {
    this.store.dispatch(UiActions.toggleTheme());
  }
  protected openNewLesson(): void {
    this.store.dispatch(UiActions.setNewLessonOpen({ open: true }));
  }
}
