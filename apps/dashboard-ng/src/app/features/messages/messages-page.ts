import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { CacheTags, cachedQuery } from '../../core/api/cache-tags';
import { MessagingApi } from '../../core/api/messaging-api';
import { authFeature } from '../../core/auth/auth.store';
import { timeOf } from '../../core/format';
import { LiveSocketService } from '../../core/live/live-socket.service';
import { Avatar } from '../../shared/avatar';
import { Card } from '../../shared/card';

/**
 * Port of features/messages/MessagesScreen.tsx — thread list + conversation +
 * composer, updated live. Screen-local data, so `cachedQuery`s rather than
 * NgRx: the Socket.IO event invalidates their tags and they reload.
 */
@Component({
  selector: 'th-messages-page',
  imports: [Avatar, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages-page.html',
})
export class MessagesPage {
  private readonly api = inject(MessagingApi);
  private readonly destroyRef = inject(DestroyRef);

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

    // Mark the open conversation read when it has unread messages.
    effect(() => {
      const active = this.active();
      if (active && active.unread > 0) {
        this.api
          .markConversationRead(active.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();
      }
    });

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
    this.api.sendMessage(active.id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
