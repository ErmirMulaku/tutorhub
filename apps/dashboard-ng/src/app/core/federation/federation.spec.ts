import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { NativeFederationResult } from '@angular-architects/native-federation';
import { FEDERATION, RemoteModules, RemoteUnavailableError, remoteRoutes } from './federation';
import { RELOAD_PAGE, RemoteUnavailable } from './remote-unavailable';

@Component({
  selector: 'th-remote-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p class="remote-page">Remote page</p>',
})
class RemotePage {}

const REMOTE_MODULE = { REVIEWS_ROUTES: [{ path: '', component: RemotePage }] satisfies Routes };

/**
 * A stand-in for the `initFederation()` result: `loadRemoteModule` answers
 * with whatever `next` is set to. Only the members RemoteModules uses.
 */
function fakeFederation(): {
  federation: NativeFederationResult;
  load: jasmine.Spy;
  initRemoteEntry: jasmine.Spy;
} {
  const load = jasmine.createSpy('loadRemoteModule');
  const initRemoteEntry = jasmine.createSpy('initRemoteEntry').and.resolveTo(undefined);
  const federation = {
    loadRemoteModule: load,
    initRemoteEntry,
  } as unknown as NativeFederationResult;
  return { federation, load, initRemoteEntry };
}

describe('remote routes', () => {
  let load: jasmine.Spy;
  let reload: jasmine.Spy;
  let consoleError: jasmine.Spy;

  beforeEach(() => {
    const fake = fakeFederation();
    load = fake.load;
    reload = jasmine.createSpy('reloadPage');
    consoleError = spyOn(console, 'error');
    // The manifest lookup on a failed load: no `reviews` entry, so no re-registering.
    spyOn(window, 'fetch').and.callFake(() => Promise.resolve(new Response('{}')));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          remoteRoutes({
            path: 'reviews',
            remote: 'reviews',
            exposed: './routes',
            exportName: 'REVIEWS_ROUTES',
            fallback: RemoteUnavailable,
            data: { label: 'Reviews' },
          }),
          withComponentInputBinding(),
        ),
        { provide: FEDERATION, useValue: fake.federation },
        { provide: RELOAD_PAGE, useValue: reload },
      ],
    });
  });

  const text = (harness: RouterTestingHarness): string =>
    (harness.routeNativeElement?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const clickRetry = (harness: RouterTestingHarness): void => {
    const button = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent.trim() === 'Retry',
    );
    if (!button) throw new Error('no Retry button');
    button.click();
  };

  it('renders the remote page when the remote loads', async () => {
    load.and.resolveTo(REMOTE_MODULE);
    const harness = await RouterTestingHarness.create('/reviews');
    expect(text(harness)).toBe('Remote page');
  });

  it('shows the fallback, not a broken router, when the remote load rejects', async () => {
    load.and.rejectWith(new TypeError('Failed to fetch'));
    const harness = await RouterTestingHarness.create('/reviews');

    expect(text(harness)).toContain('Reviews is temporarily unavailable.');
    expect(harness.routeDebugElement?.componentInstance).toEqual(jasmine.any(RemoteUnavailable));
    // One line from our code per failed attempt (the runtime adds its own).
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('Retry loads the remote in place once it is back — no page reload', async () => {
    load.and.rejectWith(new TypeError('Failed to fetch'));
    const harness = await RouterTestingHarness.create('/reviews');

    load.and.resolveTo(REMOTE_MODULE);
    clickRetry(harness);
    await harness.fixture.whenStable();

    expect(text(harness)).toBe('Remote page');
    expect(reload).not.toHaveBeenCalled();
  });

  it('Retry reloads the page when the remote still fails in place', async () => {
    load.and.rejectWith(new TypeError('Failed to fetch'));
    const harness = await RouterTestingHarness.create('/reviews');

    clickRetry(harness);
    await harness.fixture.whenStable();

    expect(text(harness)).toContain('Reviews is temporarily unavailable.');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('RemoteModules', () => {
  it('keeps successes but tries a failed load again', async () => {
    const fake = fakeFederation();
    spyOn(console, 'error');
    spyOn(window, 'fetch').and.callFake(() => Promise.resolve(new Response('{}')));
    TestBed.configureTestingModule({
      providers: [{ provide: FEDERATION, useValue: fake.federation }],
    });
    const modules = TestBed.inject(RemoteModules);

    fake.load.and.rejectWith(new Error('down'));
    await expectAsync(modules.load('reviews', './routes')).toBeRejectedWith(
      jasmine.any(RemoteUnavailableError),
    );

    fake.load.and.resolveTo(REMOTE_MODULE);
    await expectAsync(modules.load('reviews', './routes')).toBeResolvedTo(REMOTE_MODULE);
    await expectAsync(modules.load('reviews', './routes')).toBeResolvedTo(REMOTE_MODULE);
    // The failed attempt, then one successful load; the third call is the cached one.
    expect(fake.load).toHaveBeenCalledTimes(2);
  });

  it('registers a remote skipped at startup from the manifest before trying again', async () => {
    const fake = fakeFederation();
    spyOn(window, 'fetch').and.callFake(() =>
      Promise.resolve(
        new Response(JSON.stringify({ reviews: 'http://remote.test/remoteEntry.json' })),
      ),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: FEDERATION, useValue: fake.federation }],
    });
    fake.load.and.returnValues(
      Promise.reject(new Error("Remote 'reviews' is not initialized.")),
      Promise.resolve(REMOTE_MODULE),
    );

    await expectAsync(TestBed.inject(RemoteModules).load('reviews', './routes')).toBeResolvedTo(
      REMOTE_MODULE,
    );
    expect(fake.initRemoteEntry).toHaveBeenCalledOnceWith(
      'http://remote.test/remoteEntry.json',
      'reviews',
    );
  });

  it('fails without trying when Native Federation did not start', async () => {
    spyOn(console, 'error');
    TestBed.configureTestingModule({ providers: [{ provide: FEDERATION, useValue: null }] });
    await expectAsync(TestBed.inject(RemoteModules).load('reviews', './routes')).toBeRejectedWith(
      jasmine.any(RemoteUnavailableError),
    );
  });
});
