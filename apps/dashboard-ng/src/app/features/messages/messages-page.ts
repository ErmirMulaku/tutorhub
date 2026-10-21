import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { EMPTY, catchError, exhaustMap, filter } from 'rxjs';
import { CacheTags, cachedQuery } from '../../core/api/cache-tags';
import { errorMessage } from '../../core/api/errors';
import { MessagingApi } from '../../core/api/messaging-api';
import type { Conversation } from '../../core/api/models';
import { authFeature } from '../../core/auth/auth.store';
import { timeOf } from '../../core/format';
import { LiveSocketService } from '../../core/live/live-socket.service';
import { Avatar } from '../../shared/avatar';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { ToastService } from '../../shared/toast';

/**
 * Port of features/messages/MessagesScreen.tsx — thread list + conversation +
 * composer, updated live. Screen-local data, so `cachedQuery`s rather than
 * NgRx: the Socket.IO event invalidates their tags and they reload.
 */
@Component({
  selector: 'th-messages-page',
  imports: [Avatar, Card, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages-page.html',
})
export class MessagesPage {
  private readonly api = inject(MessagingApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  protected readonly conversations = cachedQuery({
    tags: ['Conversation'],
    load: () => this.api.conversations(),
  });
  protected readonly activeId = signal<string | null>(null);
  /** The picked thread, or the first one until the tutor picks. */
  protected readonly active = computed(() => {
    const list = this.conversations.data() ?? [];
    return list.find((c) => c.id === this.activeId()) ?? list[0] ?? null;
  });
  // `params` follows the active thread: switching threads loads its messages,
  // and no thread means no request (React: `skip: !active`).
  protected readonly messages = cachedQuery({
    tags: ['Message'],
    params: () => this.active()?.id,
    load: (conversationId) => this.api.messages(conversationId),
  });
  protected readonly draft = signal('');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly timeOf = timeOf;

  constructor() {
    const tags = inject(CacheTags);
    const tutorId = inject(Store).selectSignal(authFeature.selectTutorId)();

    // Port of useLiveMessages: a second Socket.IO connection, only while this
    // screen is open. A new message refreshes threads, the conversation, the
    // unread badge and the notifications feed.
    if (tutorId !== null) {
      inject(LiveSocketService)
        .messages(tutorId)
        .pipe(takeUntilDestroyed())
        .subscribe(() =>
          tags.invalidate('Message', 'Conversation', 'DashboardSummary', 'Notifications'),
        );
    }

    // Mark the open conversation read when it has unread messages. A stream,
    // not an effect(): `exhaustMap` ignores new triggers while a request is in
    // flight, so a live refetch that re-emits the same unread thread can't fire
    // a second mark-read. Errors are swallowed per request so one failure
    // doesn't end the stream (the badge simply stays until the next attempt).
    toObservable(this.active)
      .pipe(
        filter((active): active is Conversation => active !== null && active.unread > 0),
        exhaustMap((active) =>
          this.api.markConversationRead(active.id).pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Keep the newest message in view. `afterRenderEffect` runs after Angular
    // has written the DOM, so scrollHeight already includes the new bubbles.
    afterRenderEffect(() => {
      this.messages.data();
      const el = this.scroller()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight });
    });
  }

  protected onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected onSend(event: Event): void {
    event.preventDefault();
    const active = this.active();
    const body = this.draft().trim();
    if (!active || body === '') return;
    this.draft.set('');
    this.api
      .sendMessage(active.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Don't lose what the tutor typed: put it back and say why.
        error: (err: unknown) => {
          this.draft.set(body);
          this.toast.show(`Message not sent: ${errorMessage(err)}`);
        },
      });
  }
}
