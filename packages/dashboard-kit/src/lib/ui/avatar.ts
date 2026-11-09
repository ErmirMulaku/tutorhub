import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

/** "Lena Hartmann" → "LH" (same rules as @ermulaku/ui). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Port of @ermulaku/ui's `<Avatar>` (initials only — the dashboard never passes an image). */
@Component({
  selector: 'th-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'th-avatar',
    role: 'img',
    '[class.th-avatar--sm]': "size() === 'sm'",
    '[class.th-avatar--md]': "size() === 'md'",
    '[class.th-avatar--lg]': "size() === 'lg'",
    '[attr.aria-label]': 'name()',
  },
  template: '{{ letters() }}',
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('md');
  protected readonly letters = computed(() => initials(this.name()));
}
