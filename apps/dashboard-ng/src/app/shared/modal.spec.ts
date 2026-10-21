import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Open</button>
    <th-modal [open]="open()" title="New promotion" (closed)="closes = closes + 1; open.set(false)">
      <p id="body">Form goes here</p>
    </th-modal>
  `,
})
class Host {
  readonly open = signal(false);
  closes = 0;
}

/**
 * The modal mounts, then flips to "open" on the next animation frame (so the
 * CSS transition runs), and unmounts 200 ms after closing. `fakeAsync` lets
 * the test step through exactly those moments with `tick(ms)` — zone.js
 * treats `requestAnimationFrame` as a 16 ms timer.
 */
describe('Modal', () => {
  let fixture: ComponentFixture<Host>;
  const $ = (selector: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  function openModal(): void {
    // `click()` alone doesn't move focus; a keyboard user focuses, then activates.
    $('#opener')?.focus();
    $('#opener')?.click();
    fixture.detectChanges();
    tick(16); // the animation frame
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement as HTMLElement); // real focus needs the DOM
    fixture.detectChanges();
  });

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  it('renders nothing while closed', () => {
    expect($('.th-modal-overlay')).toBeNull();
  });

  it('mounts, then animates in on the next frame, and takes focus', fakeAsync(() => {
    $('#opener')?.click();
    fixture.detectChanges();
    expect($('.th-modal-overlay')?.dataset['state']).toBe('closed'); // mounted, not yet shown

    tick(16);
    fixture.detectChanges();
    expect($('.th-modal-overlay')?.dataset['state']).toBe('open');
    expect(document.activeElement).toBe($('.th-modal'));
    expect($('#body')?.textContent).toBe('Form goes here'); // projected content
  }));

  it('is a labelled dialog', fakeAsync(() => {
    openModal();
    const dialog = $('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog?.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(labelledBy)?.textContent).toBe('New promotion');
  }));

  it('locks page scroll while open and restores it after the exit animation', fakeAsync(() => {
    document.body.style.overflow = 'auto';
    openModal();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect($('.th-modal-overlay')?.dataset['state']).toBe('closed'); // fading out

    tick(199);
    fixture.detectChanges();
    expect($('.th-modal-overlay')).not.toBeNull();

    tick(1);
    fixture.detectChanges();
    expect($('.th-modal-overlay')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe($('#opener')); // focus goes back
  }));

  it('closes on Escape, the × button and a backdrop click — not a click inside', fakeAsync(() => {
    const reopen = (): void => {
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();
      tick(16);
      fixture.detectChanges();
    };

    openModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closes).toBe(1);

    reopen();
    $('.th-modal__close')?.click();
    expect(fixture.componentInstance.closes).toBe(2);

    reopen();
    $('#body')?.click(); // inside the panel
    expect(fixture.componentInstance.closes).toBe(2);
    $('.th-modal-overlay')?.click(); // the backdrop itself
    expect(fixture.componentInstance.closes).toBe(3);

    tick(200);
  }));

  it('ignores Escape while closed', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closes).toBe(0);
  });
});
