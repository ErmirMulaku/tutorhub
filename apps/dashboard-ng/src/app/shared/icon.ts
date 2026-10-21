import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'sun'
  | 'moon'
  | 'bell'
  | 'search'
  | 'plus'
  | 'calendar'
  | 'dollar'
  | 'star'
  | 'chat'
  | 'arrow-right'
  | 'menu';

/**
 * Port of components/icons.tsx — Feather-style 1.9-stroke icons coloured by
 * `currentColor`. The component's host *is* the `<svg>` (`<svg th-icon="sun">`),
 * so classes like `.topbar__search-icon` land on the svg as in React.
 *
 * The children use the `svg:` prefix: Angular compiles a template as HTML, so
 * without it `<path>` would be created as an (invisible) HTML element instead
 * of an SVG one.
 */
@Component({
  selector: 'svg[th-icon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.9',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  },
  template: `
    @switch (name()) {
      @case ('sun') {
        <svg:circle cx="12" cy="12" r="4" />
        <svg:path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        />
      }
      @case ('moon') {
        <svg:path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      }
      @case ('bell') {
        <svg:path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <svg:path d="M13.7 21a2 2 0 0 1-3.4 0" />
      }
      @case ('search') {
        <svg:circle cx="11" cy="11" r="7" />
        <svg:path d="m21 21-4.3-4.3" />
      }
      @case ('plus') {
        <svg:path d="M12 5v14M5 12h14" />
      }
      @case ('calendar') {
        <svg:rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <svg:path d="M3 9h18M8 3v3M16 3v3" />
      }
      @case ('dollar') {
        <svg:path
          d="M12 2v20M17 6.5A4.5 4.5 0 0 0 12.5 4h-1a3.5 3.5 0 0 0 0 7h1a3.5 3.5 0 0 1 0 7h-1A4.5 4.5 0 0 1 7 15.5"
        />
      }
      @case ('star') {
        <svg:path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" />
      }
      @case ('chat') {
        <svg:path
          d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.1A8.4 8.4 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"
        />
      }
      @case ('arrow-right') {
        <svg:path d="M5 12h14M13 6l6 6-6 6" />
      }
      @case ('menu') {
        <svg:path d="M3 6h18M3 12h18M3 18h18" />
      }
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>({ alias: 'th-icon' });
}
