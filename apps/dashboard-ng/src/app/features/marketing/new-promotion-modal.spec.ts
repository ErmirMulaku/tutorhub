import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GraphqlError } from '../../core/api/graphql-client';
import { MarketingApi } from '../../core/api/marketing-api';
import { ToastService } from '../../shared/toast';
import { NewPromotionModal } from './new-promotion-modal';

/**
 * A Reactive Form tested through the DOM, the way a tutor uses it: type into
 * the inputs, submit, and look at what was sent. The API is a Jasmine spy, so
 * nothing leaves the test.
 */
describe('NewPromotionModal', () => {
  let fixture: ComponentFixture<NewPromotionModal>;
  let api: jasmine.SpyObj<MarketingApi>;
  let toast: jasmine.SpyObj<ToastService>;
  let closed: number;

  const $ = <T extends Element = HTMLElement>(selector: string): T =>
    (fixture.nativeElement as HTMLElement).querySelector(selector) as T;
  const errors = (): string[] =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('th-field-error small')].map(
      (e) => e.textContent?.trim() ?? '',
    );

  async function type(selector: string, value: string): Promise<void> {
    const input = $<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur')); // marks it touched → its error may show
    await fixture.whenStable();
  }
  async function choose(value: 'PERCENT' | 'FIXED'): Promise<void> {
    const select = $<HTMLSelectElement>('select');
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }
  async function submit(): Promise<void> {
    $<HTMLButtonElement>('button[type="submit"]').click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<MarketingApi>('MarketingApi', ['createPromotion']);
    api.createPromotion.and.returnValue(of({ id: 'p1' }));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    TestBed.configureTestingModule({
      imports: [NewPromotionModal],
      providers: [
        { provide: MarketingApi, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(NewPromotionModal);
    fixture.componentRef.setInput('open', true);
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    await fixture.whenStable();
  });

  it('blocks an invalid promotion and says why — mirroring the API rules', async () => {
    await type('input[formControlName="name"]', 'A');
    await type('input[formControlName="code"]', 'ng');
    await type('input[formControlName="amount"]', '150');
    await submit();

    expect(api.createPromotion).not.toHaveBeenCalled();
    expect(errors()).toEqual([
      'Use at least 2 characters.',
      'Use at least 3 characters.',
      'Must be at most 100.',
    ]);
  });

  it('upper-cases the code as it is typed', async () => {
    await type('input[formControlName="code"]', 'school15');
    expect($<HTMLInputElement>('input[formControlName="code"]').value).toBe('SCHOOL15');
  });

  it('allows more than 100 for a fixed amount and sends it in cents', async () => {
    await type('input[formControlName="name"]', 'Big summer deal');
    await type('input[formControlName="code"]', 'summer');
    await choose('FIXED');
    expect($('label:has(input[formControlName="amount"]) span').textContent).toBe(
      'Amount off (USD)',
    );
    await type('input[formControlName="amount"]', '120.5');
    await submit();

    expect(api.createPromotion).toHaveBeenCalledOnceWith({
      name: 'Big summer deal',
      code: 'SUMMER',
      discountType: 'FIXED',
      discountValue: 12050,
    });
  });

  it('keeps the typed number when switching type (React showed $0.15 for 15 %)', async () => {
    await choose('FIXED');
    expect($<HTMLInputElement>('input[formControlName="amount"]').value).toBe('15');
  });

  it('on success: toasts, closes and resets the form', async () => {
    await type('input[formControlName="name"]', 'Back to school');
    await type('input[formControlName="code"]', 'SCHOOL15');
    await submit();

    expect(api.createPromotion).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ discountType: 'PERCENT', discountValue: 15 }),
    );
    expect(toast.show).toHaveBeenCalledOnceWith('Promotion created');
    expect(closed).toBe(1);
    expect($<HTMLInputElement>('input[formControlName="name"]').value).toBe('');
  });

  it('on failure: keeps the modal open and tells the tutor why', async () => {
    api.createPromotion.and.returnValue(
      throwError(() => new GraphqlError('Code already exists', [])),
    );
    await type('input[formControlName="name"]', 'Back to school');
    await type('input[formControlName="code"]', 'SCHOOL15');
    await submit();

    expect(toast.show).toHaveBeenCalledOnceWith(
      'Could not create the promotion: Code already exists',
    );
    expect(closed).toBe(0);
    expect($<HTMLInputElement>('input[formControlName="name"]').value).toBe('Back to school');
  });
});
