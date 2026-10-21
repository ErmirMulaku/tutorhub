import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  inject,
  input,
} from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Angular port of @ermulaku/ui's `<Button>`. An *attribute* component: it
 * decorates a real `<button>` (`<button th-button size="sm">`) instead of
 * wrapping one, so native attributes (`disabled`, `type`, `(click)`) and
 * CSS like `.topbar__actions > .th-btn` work unchanged.
 */
@Component({
  selector: 'button[th-button], a[th-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'th-btn',
    '[class.th-btn--primary]': "variant() === 'primary'",
    '[class.th-btn--secondary]': "variant() === 'secondary'",
    '[class.th-btn--ghost]': "variant() === 'ghost'",
    '[class.th-btn--sm]': "size() === 'sm'",
    '[class.th-btn--md]': "size() === 'md'",
    '[class.th-btn--lg]': "size() === 'lg'",
    '[class.th-btn--block]': 'block()',
    // Like the React component: a button is type="button" unless told otherwise
    // (links get no type attribute).
    '[attr.type]': 'isLink ? null : type()',
  },
  template: '<ng-content />',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });
  readonly type = input<'button' | 'submit' | 'reset'>('button');

  protected readonly isLink =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'A';
}
