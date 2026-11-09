import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastHost, ToastService } from './toast';

/**
 * `fakeAsync` + `tick` replace Jest's fake timers: inside a fakeAsync zone,
 * `setTimeout` doesn't really wait — time only moves when the test calls
 * `tick(ms)`. (zone.js is loaded for tests only; the app itself is zoneless.)
 */
describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    toasts = TestBed.inject(ToastService);
  });

  it('shows a toast and removes it after 2.5 s', fakeAsync(() => {
    toasts.show('Lesson booked');
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Lesson booked']);

    tick(2499);
    expect(toasts.toasts().length).toBe(1);

    tick(1);
    expect(toasts.toasts()).toEqual([]);
  }));

  it('stacks toasts and dismisses each on its own timer', fakeAsync(() => {
    toasts.show('First');
    tick(1000);
    toasts.show('Second');

    tick(1500); // First is 2.5 s old, Second 1.5 s
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Second']);

    tick(1000);
    expect(toasts.toasts()).toEqual([]);
  }));
});

describe('ToastHost', () => {
  it('renders the current toasts in a polite live region', fakeAsync(() => {
    const fixture = TestBed.createComponent(ToastHost);
    TestBed.inject(ToastService).show('Reply posted');
    fixture.detectChanges();

    const stack = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.toast-stack',
    )!;
    expect(stack.getAttribute('aria-live')).toBe('polite');
    expect(stack.textContent?.trim()).toBe('Reply posted');

    tick(2500);
    fixture.detectChanges();
    expect(stack.querySelectorAll('.toast').length).toBe(0);
  }));
});
