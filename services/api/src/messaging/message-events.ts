import { Injectable } from '@nestjs/common';
import { type Observable, Subject } from 'rxjs';
import type { Message } from '../generated/prisma/client.js';

/** Carries the routing context the gateway needs alongside the message. */
export interface MessageEvent {
  message: Message;
  tutorId: string;
}

/** In-process RxJS bus for new messages, fanned out by the Socket.IO gateway. */
@Injectable()
export class MessageEvents {
  private readonly messages = new Subject<MessageEvent>();

  emit(event: MessageEvent): void {
    this.messages.next(event);
  }

  all(): Observable<MessageEvent> {
    return this.messages.asObservable();
  }
}
