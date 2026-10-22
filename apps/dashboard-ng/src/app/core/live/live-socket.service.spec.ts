import { TestBed } from '@angular/core/testing';
import { LIVE_SOCKET_FACTORY, type LiveSocket, LiveSocketService } from './live-socket.service';

/** Just enough of a socket.io client: records calls and lets a test fire events. */
class FakeSocket implements LiveSocket {
  private readonly handlers = new Map<string, Set<(payload: never) => void>>();
  readonly emitted: [string, unknown][] = [];
  closed = false;

  on<T>(event: string, listener: (payload: T) => void): this {
    const set = this.handlers.get(event) ?? new Set();
    set.add(listener);
    this.handlers.set(event, set);
    return this;
  }
  off<T>(event: string, listener: (payload: T) => void): this {
    this.handlers.get(event)?.delete(listener);
    return this;
  }
  emit(event: string, payload: unknown): this {
    this.emitted.push([event, payload]);
    return this;
  }
  close(): this {
    this.closed = true;
    return this;
  }
  /** What the server would do: fire an event at every listener. */
  fire(event: string, payload?: unknown): void {
    this.handlers.get(event)?.forEach((listener) => listener(payload as never));
  }
  listenerCount(): number {
    return [...this.handlers.values()].reduce((n, set) => n + set.size, 0);
  }
}

describe('LiveSocketService', () => {
  let sockets: FakeSocket[];
  let live: LiveSocketService;

  beforeEach(() => {
    sockets = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LIVE_SOCKET_FACTORY,
          useValue: () => {
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket;
          },
        },
      ],
    });
    live = TestBed.inject(LiveSocketService);
  });

  it('is cold: nothing connects until someone subscribes', () => {
    const changes$ = live.bookingChanges('t1');
    expect(sockets.length).toBe(0);
    changes$.subscribe();
    expect(sockets.length).toBe(1);
  });

  it('joins the tutor room on connect — and again after every reconnect', () => {
    live.bookingChanges('t1').subscribe();
    const socket = sockets[0]!;

    socket.fire('connect');
    socket.fire('connect'); // socket.io fires `connect` again after a reconnect
    expect(socket.emitted).toEqual([
      ['subscribeTutor', { tutorId: 't1' }],
      ['subscribeTutor', { tutorId: 't1' }],
    ]);
  });

  it('streams bookingChanged payloads to the subscriber', () => {
    const received: unknown[] = [];
    live.bookingChanges('t1').subscribe((c) => received.push(c));
    sockets[0]!.fire('bookingChanged', { id: 'b1', status: 'CONFIRMED' });
    expect(received).toEqual([{ id: 'b1', status: 'CONFIRMED' }]);
  });

  it('unsubscribing removes its listeners and closes the socket', () => {
    const sub = live.bookingChanges('t1').subscribe();
    const socket = sockets[0]!;
    expect(socket.listenerCount()).toBe(2);

    sub.unsubscribe(); // what takeUntilDestroyed() does when a component goes away

    expect(socket.listenerCount()).toBe(0);
    expect(socket.closed).toBeTrue();
  });

  it('gives each subscriber its own connection (shell + Messages, as in React)', () => {
    live.bookingChanges('t1').subscribe();
    live.messages('t1').subscribe();
    expect(sockets.length).toBe(2);

    sockets[1]!.fire('connect');
    expect(sockets[1]!.emitted).toEqual([['subscribeMessages', { tutorId: 't1' }]]);
    expect(sockets[0]!.emitted).toEqual([]);
  });
});
