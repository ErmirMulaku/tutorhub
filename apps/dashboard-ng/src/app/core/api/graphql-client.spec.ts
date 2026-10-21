import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { environment } from '../../../environments/environment';
import { AuthActions } from '../auth/auth.store';
import { CacheTags } from './cache-tags';
import { GraphqlClient, GraphqlError } from './graphql-client';
import { MarketingApi } from './marketing-api';

const URL = `${environment.apiUrl}/graphql`;

describe('GraphqlClient', () => {
  let client: GraphqlClient;
  let backend: HttpTestingController;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideMockStore()],
    });
    client = TestBed.inject(GraphqlClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject<MockStore<object>>(MockStore);
    spyOn(store, 'dispatch');
  });

  afterEach(() => backend.verify());

  it('POSTs the document and variables, and unwraps `data`', () => {
    let result: unknown;
    client
      .request<{ meTutor: { name: string } }>('{ meTutor { name } }', { a: 1 })
      .subscribe((r) => (result = r));

    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ query: '{ meTutor { name } }', variables: { a: 1 } });
    req.flush({ data: { meTutor: { name: 'Lena' } } });

    expect(result).toEqual({ meTutor: { name: 'Lena' } });
  });

  it('turns `errors` (sent with HTTP 200) into a GraphqlError', () => {
    let error: unknown;
    client.request('{ x }').subscribe({ error: (e: unknown) => (error = e) });
    backend
      .expectOne(URL)
      .flush({ errors: [{ message: 'Not found', extensions: { code: 'NOT_FOUND' } }] });

    expect(error).toEqual(jasmine.any(GraphqlError));
    expect((error as GraphqlError).message).toBe('Not found');
    expect((error as GraphqlError).errors[0]?.extensions?.code).toBe('NOT_FOUND');
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('clears the session on a GraphQL auth error — they never reach the 401 path', () => {
    client.request('{ x }').subscribe({ error: () => undefined });
    backend.expectOne(URL).flush({ errors: [{ message: 'Unauthorized' }] });
    expect(store.dispatch).toHaveBeenCalledOnceWith(AuthActions.clearCredentials());
  });

  it('rejects a body with neither data nor errors', () => {
    let error: unknown;
    client.request('{ x }').subscribe({ error: (e: unknown) => (error = e) });
    backend.expectOne(URL).flush({});
    expect((error as Error).message).toBe('Empty GraphQL response');
  });
});

/** One API service end to end: the document it sends and the tags it invalidates. */
describe('MarketingApi', () => {
  let api: MarketingApi;
  let backend: HttpTestingController;
  let invalidate: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideMockStore()],
    });
    api = TestBed.inject(MarketingApi);
    backend = TestBed.inject(HttpTestingController);
    invalidate = spyOn(TestBed.inject(CacheTags), 'invalidate');
  });

  afterEach(() => backend.verify());

  const input = {
    name: 'Back to school',
    code: 'SCHOOL15',
    discountType: 'PERCENT' as const,
    discountValue: 15,
  };

  it('creates a promotion and invalidates `Marketing`, like api.ts', () => {
    let created: unknown;
    api.createPromotion(input).subscribe((r) => (created = r));

    const req = backend.expectOne(URL);
    const body = req.request.body as { query: string; variables: unknown };
    expect(body.query).toContain('createPromotion(input: $input)');
    expect(body.variables).toEqual({ input });
    req.flush({ data: { createPromotion: { id: 'p1' } } });

    expect(created).toEqual({ id: 'p1' });
    expect(invalidate).toHaveBeenCalledOnceWith('Marketing');
  });

  it('does not invalidate anything when the mutation fails', () => {
    api.createPromotion(input).subscribe({ error: () => undefined });
    backend.expectOne(URL).flush({ errors: [{ message: 'Bad Request Exception' }] });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
