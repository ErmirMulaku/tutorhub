import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH, authInterceptor } from './auth.interceptor';
import { AuthActions, authFeature } from './auth.store';

/**
 * `HttpTestingController` is Angular's fake backend: requests made through
 * HttpClient are held until the test answers them with `flush()`, so each
 * request's URL, headers and body can be inspected first.
 */
describe('authInterceptor', () => {
  const api = `${environment.apiUrl}/graphql`;
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideMockStore(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject<MockStore<object>>(MockStore);
    store.overrideSelector(authFeature.selectToken, 'jwt-123');
    spyOn(store, 'dispatch');
  });

  afterEach(() => backend.verify()); // no request left unanswered

  it('adds the Bearer token to API calls', () => {
    http.post(api, {}).subscribe();
    expect(backend.expectOne(api).request.headers.get('authorization')).toBe('Bearer jwt-123');
  });

  it('sends no Authorization header when signed out', () => {
    store.overrideSelector(authFeature.selectToken, null);
    store.refreshState();
    http.post(api, {}).subscribe();
    expect(backend.expectOne(api).request.headers.has('authorization')).toBeFalse();
  });

  it('never leaks the token to another origin', () => {
    http.get('https://example.com/data').subscribe();
    expect(
      backend.expectOne('https://example.com/data').request.headers.has('authorization'),
    ).toBeFalse();
  });

  it('skips the token for the pre-session auth calls (SKIP_AUTH)', () => {
    http.post(api, {}, { context: new HttpContext().set(SKIP_AUTH, true) }).subscribe();
    expect(backend.expectOne(api).request.headers.has('authorization')).toBeFalse();
  });

  it('clears the session on a 401 and still reports the error', () => {
    let error: unknown;
    http.post(api, {}).subscribe({ error: (e: unknown) => (error = e) });
    backend.expectOne(api).flush('expired', { status: 401, statusText: 'Unauthorized' });

    expect(store.dispatch).toHaveBeenCalledOnceWith(AuthActions.clearCredentials());
    expect(error).toEqual(jasmine.any(HttpErrorResponse));
  });

  it('keeps the session on other errors', () => {
    http.post(api, {}).subscribe({ error: () => undefined });
    backend.expectOne(api).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
