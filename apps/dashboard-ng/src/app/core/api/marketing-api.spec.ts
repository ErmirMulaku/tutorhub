import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL, CacheTags } from '@ermulaku/dashboard-kit';
import { provideMockStore } from '@ngrx/store/testing';
import { environment } from '../../../environments/environment';
import { MarketingApi } from './marketing-api';

const URL = `${environment.apiUrl}/graphql`;

/** One API service end to end: the document it sends and the tags it invalidates. */
describe('MarketingApi', () => {
  let api: MarketingApi;
  let backend: HttpTestingController;
  let invalidate: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore(),
        { provide: API_BASE_URL, useValue: environment.apiUrl },
      ],
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
