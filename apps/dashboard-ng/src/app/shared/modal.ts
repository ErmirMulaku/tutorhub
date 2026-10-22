import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

const EXIT_MS = 200;
let nextId = 0;

/**
 * Port of @ermulaku/ui's `<Modal>`: fade/scale in and out, Escape and
 * backdrop-click to close, body scroll lock, focus moved in and restored.
 *
 * React rendered it through a portal into <body>. It's left in place here: the
 * overlay is `position: fixed`, and no ancestor in this app creates a
 * containing block for it, so it covers the viewport the same way without
 * pulling in the CDK's overlay.
 */
@Component({
  selector: 'th-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (mounted()) {
      <!-- The backdrop click is a mouse shortcut only; keyboard users close with
           Escape (document listener) or the focusable × button, so a focusable
           backdrop would just add a confusing tab stop. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div
        class="th-modal-overlay"
        [attr.data-state]="visible() ? 'open' : 'closed'"
        (click)="onBackdrop($event)"
      >
        <div
          #panel
          class="th-modal {{ panelClass() }}"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="title() ? titleId : null"
          tabindex="-1"
        >
          <button type="button" class="th-modal__close" aria-label="Close" (click)="closed.emit()">
            ×
          </button>
          @if (title(); as t) {
            <h2 [id]="titleId">{{ t }}</h2>
          }
          <ng-content />
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input.required<boolean>();
  readonly title = input<string>();
  /** Extra class on the panel (React's `className`). */
  readonly panelClass = input('');
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();

  protected readonly titleId = `th-modal-${String(nextId++)}`;
  protected readonly mounted = signal(false);
  protected readonly visible = signal(false);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly document = inject(DOCUMENT);
  private lastFocused: HTMLElement | null = null;

  constructor() {
    // Mount, then flip `visible` on the next frame so the CSS transition runs;
    // on close, wait for the exit transition before unmounting. The cleanup
    // callback cancels a pending frame/timer if `open` flips again first.
    effect((onCleanup) => {
      if (this.open()) {
        this.lastFocused = this.document.activeElement as HTMLElement | null;
        this.mounted.set(true);
        const raf = requestAnimationFrame(() => this.visible.set(true));
        onCleanup(() => cancelAnimationFrame(raf));
      } else {
        this.visible.set(false);
        const timer = setTimeout(() => this.mounted.set(false), EXIT_MS);
        onCleanup(() => clearTimeout(timer));
      }
    });

    // Focus the panel once shown; give focus back after it unmounts.
    effect(() => {
      if (this.visible()) this.panel()?.nativeElement.focus();
      else if (!this.mounted()) this.lastFocused?.focus();
    });

    // Lock page scroll while mounted.
    effect((onCleanup) => {
      if (!this.mounted()) return;
      const body = this.document.body;
      const previous = body.style.overflow;
      body.style.overflow = 'hidden';
      onCleanup(() => (body.style.overflow = previous));
    });
  }

  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === event.currentTarget) this.closed.emit();
  }
}
