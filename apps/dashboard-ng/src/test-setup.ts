import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/*
 * Runs before every spec (angular.json → test.options.include lists it first).
 *
 * zone.js sits in the *test* polyfills only, so `fakeAsync` / `tick` work. But
 * when the builder sees zone.js it also initialises TestBed with zone-based
 * change detection — which the app (zoneless) never uses, and which would hide
 * bugs such as an OnPush component that never tells Angular it changed. This
 * top-level `beforeEach` (outside any `describe`, so Jasmine applies it to
 * every spec) puts each TestBed back on zoneless change detection.
 */
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

/*
 * Angular then warns NG0914 ("zoneless, but Zone.js is still loaded") once per
 * TestBed — exactly the setup above, on purpose. Drop only that warning so real
 * ones stay visible.
 */
const warn = console.warn.bind(console);
console.warn = (...args: unknown[]): void => {
  if (typeof args[0] === 'string' && args[0].includes('NG0914')) return;
  warn(...args);
};
