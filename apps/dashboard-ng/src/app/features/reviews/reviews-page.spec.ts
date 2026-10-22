import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { GraphqlError } from '../../core/api/graphql-client';
import type { TutorReview } from '../../core/api/models';
import { ReviewsApi } from '../../core/api/reviews-api';
import { ToastService } from '../../shared/toast';
import { ReviewCard } from './reviews-page';

const review = (overrides: Partial<TutorReview> = {}): TutorReview => ({
  id: 'r1',
  studentName: 'Mia Chen',
  studentAvatarColor: null,
  subjectName: 'Mathematics',
  rating: 4,
  comment: 'Great session.',
  reply: null,
  createdAt: '2026-07-16T10:00:00.000Z',
  ...overrides,
});

describe('ReviewCard', () => {
  let fixture: ComponentFixture<ReviewCard>;
  let api: jasmine.SpyObj<ReviewsApi>;
  let toast: jasmine.SpyObj<ToastService>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const input = (): HTMLInputElement => el().querySelector('input')!;
  const button = (): HTMLButtonElement => el().querySelector('.review__reply-form button')!;

  async function create(r: TutorReview): Promise<void> {
    api = jasmine.createSpyObj<ReviewsApi>('ReviewsApi', ['reply']);
    api.reply.and.returnValue(of(undefined));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    TestBed.configureTestingModule({
      imports: [ReviewCard],
      providers: [
        { provide: ReviewsApi, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ReviewCard);
    fixture.componentRef.setInput('review', r);
    await fixture.whenStable();
  }

  async function typeReply(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('shows an existing reply instead of the reply box', async () => {
    await create(review({ reply: 'Thanks Mia!' }));
    expect(el().querySelector('.review__reply')?.textContent).toContain('Thanks Mia!');
    expect(el().querySelector('input')).toBeNull();
  });

  it('enables Reply only once there is non-blank text', async () => {
    await create(review());
    expect(button().disabled).toBeTrue();
    await typeReply('   ');
    expect(button().disabled).toBeTrue();
    await typeReply('Thank you!');
    expect(button().disabled).toBeFalse();
  });

  it('sends the trimmed reply on click and on Enter', async () => {
    await create(review());
    await typeReply('  Thank you!  ');
    button().click();
    expect(api.reply).toHaveBeenCalledOnceWith('r1', 'Thank you!');
    expect(toast.show).toHaveBeenCalledOnceWith('Reply posted');

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(api.reply).toHaveBeenCalledTimes(2);
  });

  it('cannot double-send while a reply is in flight', async () => {
    await create(review());
    const pending = new Subject<void>();
    api.reply.and.returnValue(pending);
    await typeReply('Thank you!');

    button().click();
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(api.reply).toHaveBeenCalledTimes(1);
    await fixture.whenStable();
    expect(button().disabled).toBeTrue();

    pending.complete();
    await fixture.whenStable();
    expect(button().disabled).toBeFalse();
  });

  it('keeps the draft and explains a failure', async () => {
    await create(review());
    api.reply.and.returnValue(throwError(() => new GraphqlError('Review not found', [])));
    await typeReply('Thank you!');
    button().click();
    await fixture.whenStable();

    expect(toast.show).toHaveBeenCalledOnceWith('Could not post the reply: Review not found');
    expect(input().value).toBe('Thank you!');
  });
});
