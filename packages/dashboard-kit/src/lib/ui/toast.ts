import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

interface ToastItem {
  id: number;
  message: string;
}

const TOAST_MS = 2500;

/**
 * Port of ToastProvider's context: any component can `inject(ToastService)`
 * and call `show()`. React needed a Provider in the tree; an Angular
 * `providedIn: 'root'` service is a singleton available everywhere.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<ToastItem[]>([]);

  show(message: string): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message }]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }
}

/** Renders the toast stack (bottom-centre, fade-up). Mounted once, in the app root. */
@Component({
  selector: 'th-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Above the onboarding overlay (z-index 2000) and its modal (2100).
  styles: '.toast-stack { z-index: 2200; }',
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toasts(); track t.id) {
        <div class="toast th-fade-up">{{ t.message }}</div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService).toasts;
}
