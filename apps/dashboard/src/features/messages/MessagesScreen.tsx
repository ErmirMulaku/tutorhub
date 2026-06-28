import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import { Avatar, Card } from '@ermulaku/ui';
import {
  useGetConversationsQuery,
  useGetMessagesQuery,
  useMarkConversationReadMutation,
  useSendMessageMutation,
} from '../../store/api';
import { useLiveMessages } from '../live/use-live-messages';
import { useAppSelector } from '../../store/hooks';
import { timeOf } from '../../lib/format';

export function MessagesScreen(): JSX.Element {
  const tutorId = useAppSelector((s) => s.auth.tutorId);
  useLiveMessages(tutorId);
  const { data: conversations } = useGetConversationsQuery();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = conversations?.find((c) => c.id === activeId) ?? conversations?.[0] ?? null;
  const { data: messages } = useGetMessagesQuery(active?.id ?? '', { skip: !active });
  const [send] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark the open conversation read when it has unread messages.
  useEffect(() => {
    if (active && active.unread > 0) void markRead(active.id);
  }, [active, markRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function onSend(e: FormEvent): void {
    e.preventDefault();
    if (!active || draft.trim() === '') return;
    const body = draft.trim();
    setDraft('');
    void send({ conversationId: active.id, body });
  }

  return (
    <Card className="chat">
      <div className="chat__list">
        {conversations?.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chat__thread${active?.id === c.id ? ' chat__thread--active' : ''}`}
            onClick={() => setActiveId(c.id)}
          >
            <Avatar name={c.studentName} size="md" />
            <div className="chat__thread-body">
              <div className="chat__thread-top">
                <span className={`chat__thread-name${c.unread > 0 ? ' chat__thread-name--unread' : ''}`}>
                  {c.studentName}
                </span>
                <span className="muted chat__thread-time">{timeOf(c.lastMessageAt)}</span>
              </div>
              <div className="chat__thread-preview muted">{c.preview}</div>
            </div>
            {c.unread > 0 && <span className="chat__unread">{c.unread}</span>}
          </button>
        ))}
      </div>

      <div className="chat__pane">
        {active ? (
          <>
            <div className="chat__header">
              <Avatar name={active.studentName} size="md" />
              <div>
                <div className="chat__header-name">{active.studentName}</div>
                <div className="muted">{active.subjectName} student · Active now</div>
              </div>
            </div>
            <div className="chat__messages" ref={scrollRef}>
              {messages?.map((m) => (
                <div
                  key={m.id}
                  className={`chat__bubble chat__bubble--${m.senderKind === 'TUTOR' ? 'mine' : 'theirs'}`}
                >
                  {m.body}
                </div>
              ))}
            </div>
            <form className="chat__composer" onSubmit={onSend}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
              />
              <button type="submit" className="chat__send">
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="chat__empty muted">Select a conversation to start chatting.</div>
        )}
      </div>
    </Card>
  );
}
