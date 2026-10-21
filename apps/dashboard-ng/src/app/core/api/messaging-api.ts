import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type { ChatMessage, Conversation } from './models';

/** Conversations and messages. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class MessagingApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  conversations(): Observable<Conversation[]> {
    return this.gql
      .request<{
        conversations: Conversation[];
      }>(
        `{ conversations { id studentName studentAvatarColor subjectName lastMessageAt preview unread } }`,
      )
      .pipe(map((r) => r.conversations));
  }

  messages(conversationId: string): Observable<ChatMessage[]> {
    return this.gql
      .request<{
        messages: ChatMessage[];
      }>(`query($id: ID!){ messages(conversationId: $id){ id senderKind body createdAt } }`, {
        id: conversationId,
      })
      .pipe(map((r) => r.messages));
  }

  sendMessage(conversationId: string, body: string): Observable<{ id: string }> {
    return this.gql
      .request<{
        sendMessage: { id: string };
      }>(
        `mutation($id: ID!, $body: String!){ sendMessage(conversationId: $id, body: $body){ id } }`,
        { id: conversationId, body },
      )
      .pipe(
        map((r) => r.sendMessage),
        tap(() => this.tags.invalidate('Message', 'Conversation')),
      );
  }

  markConversationRead(conversationId: string): Observable<void> {
    return this.gql
      .request(`mutation($id: ID!){ markConversationRead(conversationId: $id){ id } }`, {
        id: conversationId,
      })
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Conversation', 'DashboardSummary', 'Notifications')),
      );
  }
}
