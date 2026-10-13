'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';

type FailureReason = 'UNAVAILABLE' | 'RATE_LIMITED' | 'BUDGET_EXCEEDED' | 'NOT_AUTHENTICATED' | 'FAILED';

interface Citation {
  n: number;
  articleId: string;
  title: string;
}

interface Confirmation {
  token: string;
  toolName: string;
  summary: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'dismissed' | 'error';
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  sources?: Citation[];
  confirmation?: Confirmation;
}

type ChatStreamEvent =
  | { token: string }
  | { tool_call: { name: string } }
  | { tool_result: { name: string; ok: boolean } }
  | { confirmation_required: { token: string; toolName: string; summary: string } }
  | { citations: Citation[] }
  | { done: true; sources?: Citation[]; error?: string };

function replaceAt<T>(items: T[], index: number, update: (item: T) => T): T[] {
  return items.map((item, i) => (i === index ? update(item) : item));
}

function toolErrorMessage(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null || !('error' in result)) return undefined;
  return typeof result.error === 'string' ? result.error : undefined;
}

/**
 * Streams one unified-chat turn from `app/api/chat/route.ts` (which proxies
 * the AI gateway's `POST /ai/chat/stream` SSE response) and reports progress
 * via callbacks. `onFailure` fires once if the request never streams at all
 * (pre-stream 401/429/503/400) or fails partway through.
 */
async function streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  signal: AbortSignal,
  handlers: {
    onToken: (answerSoFar: string) => void;
    onToolCall: (name: string) => void;
    onToolResult: () => void;
    onConfirmation: (c: { token: string; toolName: string; summary: string }) => void;
    onCitations: (sources: Citation[]) => void;
    onDone: (sources: Citation[]) => void;
    onFailure: (reason: FailureReason, retryAfterSec?: number) => void;
  },
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch {
    if (!signal.aborted) handlers.onFailure('FAILED');
    return;
  }

  if (!response.ok) {
    const body = await response
      .json()
      .then((b: { reason?: FailureReason; retryAfterSec?: number }) => b)
      .catch((): { reason?: FailureReason; retryAfterSec?: number } => ({}));
    handlers.onFailure(body.reason ?? 'FAILED', body.retryAfterSec);
    return;
  }

  const reader = response.body?.getReader();
  if (reader === undefined) {
    handlers.onFailure('FAILED');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');

      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine === undefined) continue;
      const event = JSON.parse(dataLine.slice('data: '.length)) as ChatStreamEvent;

      if ('token' in event) {
        answer += event.token;
        handlers.onToken(answer);
      } else if ('tool_call' in event) {
        handlers.onToolCall(event.tool_call.name);
      } else if ('tool_result' in event) {
        handlers.onToolResult();
      } else if ('confirmation_required' in event) {
        handlers.onConfirmation(event.confirmation_required);
      } else if ('citations' in event) {
        handlers.onCitations(event.citations);
      } else {
        handlers.onDone(event.sources ?? []);
        if (event.error !== undefined) handlers.onFailure('UNAVAILABLE');
      }
    }
  }
}

/** Other components (e.g. the header link) open the widget by firing this. */
export const ASSISTANT_OPEN_EVENT = 'tutorhub:assistant-open';

/** The orbit mark used across the brand, reused as the assistant's avatar. */
function AssistantMark({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Floating assistant widget — one chat for help questions and booking
 * actions. Help answers carry citations linking to `/help/[articleId]`;
 * write actions (book/cancel a lesson) never happen directly — a
 * confirmation card appears and the user must press Confirm, which calls
 * `POST /ai/chat/confirm` (via `app/api/chat/confirm/route.ts`). Turns go
 * through same-origin route handlers, keeping the session token out of the
 * browser.
 */
export function AssistantWidget({
  dict,
  locale,
  authenticated,
}: {
  dict: Dictionary;
  locale: Locale;
  authenticated: boolean;
}): React.JSX.Element {
  const t = dict.assistant;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // A closed panel shouldn't keep paying for tokens no one will see —
  // mirrors the gateway's own res.on('close') abort.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the panel mounted through its close animation, then unmount.
  useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }
    if (!render) return;
    const id = window.setTimeout(() => setRender(false), 180);
    return () => window.clearTimeout(id);
  }, [open, render]);

  // Let other components (the header entry) open the widget.
  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
  }, []);

  // Esc closes; focus the composer when the panel appears.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
    };
  }, [open]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, toolStatus, pending, render]);

  const submit = useCallback(
    (content: string): void => {
      const text = content.trim();
      if (text === '' || pending) return;

      // The API takes the whole history each turn; it holds no conversation state.
      const history: ChatTurn[] = [...turns, { role: 'user', content: text }];
      const assistantIndex = history.length;
      setTurns([...history, { role: 'assistant', content: '' }]);
      setInput('');
      setNotice(null);
      setToolStatus(null);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      startTransition(() => {
        void streamChat(
          history.map(({ role, content: c }) => ({ role, content: c })),
          controller.signal,
          {
            onToken: (answer) =>
              setTurns((prev) => replaceAt(prev, assistantIndex, (turn) => ({ ...turn, content: answer }))),
            onToolCall: (name) =>
              setToolStatus(name === 'search_help_articles' ? t.toolStatusHelp : t.toolStatusBooking),
            onToolResult: () => setToolStatus(null),
            onConfirmation: (c) => {
              setToolStatus(null);
              setTurns((prev) =>
                replaceAt(prev, assistantIndex, (turn) => ({
                  ...turn,
                  confirmation: { ...c, status: 'pending' },
                })),
              );
            },
            onCitations: (sources) =>
              setTurns((prev) => replaceAt(prev, assistantIndex, (turn) => ({ ...turn, sources }))),
            onDone: (sources) => {
              setToolStatus(null);
              if (sources.length > 0) {
                setTurns((prev) => replaceAt(prev, assistantIndex, (turn) => ({ ...turn, sources })));
              }
            },
            onFailure: (reason, retryAfterSec) => {
              setToolStatus(null);
              setNotice(
                reason === 'UNAVAILABLE'
                  ? t.unavailable
                  : reason === 'RATE_LIMITED'
                    ? interpolate(t.rateLimited, { seconds: retryAfterSec ?? 60 })
                    : reason === 'BUDGET_EXCEEDED'
                      ? t.budgetExceeded
                      : reason === 'NOT_AUTHENTICATED'
                        ? t.signInRequired
                        : t.failed,
              );
            },
          },
        );
      });
    },
    [pending, turns, t],
  );

  const confirmAction = useCallback(
    (turnIndex: number, token: string): void => {
      setTurns((prev) =>
        replaceAt(prev, turnIndex, (turn) =>
          turn.confirmation === undefined
            ? turn
            : { ...turn, confirmation: { ...turn.confirmation, status: 'confirming' } },
        ),
      );
      void fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((res) => res.json())
        .then((body: { ok?: boolean; toolName?: string; result?: unknown }) => {
          const ok = body.ok === true;
          const note = ok
            ? t.confirmSuccess
            : interpolate(t.confirmFailure, { error: toolErrorMessage(body.result) ?? t.failed });
          setTurns((prev) =>
            replaceAt(prev, turnIndex, (turn) =>
              turn.confirmation === undefined
                ? turn
                : {
                    ...turn,
                    content: `${turn.content}\n\n${note}`,
                    confirmation: { ...turn.confirmation, status: ok ? 'confirmed' : 'error' },
                  },
            ),
          );
          if (ok) router.refresh();
        })
        .catch(() => {
          setTurns((prev) =>
            replaceAt(prev, turnIndex, (turn) =>
              turn.confirmation === undefined
                ? turn
                : {
                    ...turn,
                    content: `${turn.content}\n\n${interpolate(t.confirmFailure, { error: t.failed })}`,
                    confirmation: { ...turn.confirmation, status: 'error' },
                  },
            ),
          );
        });
    },
    [t, router],
  );

  const dismissConfirmation = useCallback(
    (turnIndex: number): void => {
      setTurns((prev) =>
        replaceAt(prev, turnIndex, (turn) =>
          turn.confirmation === undefined
            ? turn
            : {
                ...turn,
                content: `${turn.content}\n\n${t.confirmDismissed}`,
                confirmation: { ...turn.confirmation, status: 'dismissed' },
              },
        ),
      );
    },
    [t],
  );

  const suggestions = [t.suggest1, t.suggest2, t.suggest3];
  const lastTurn = turns.at(-1);
  const showTyping = pending && lastTurn?.role === 'assistant' && lastTurn.content === '' && toolStatus === null;
  const showToolStatus = pending && toolStatus !== null;

  return (
    <>
      <button
        type="button"
        className="aw-launcher"
        aria-label={open ? t.close : t.open}
        aria-expanded={open}
        aria-controls="assistant-panel"
        data-open={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="aw-launcher__icon aw-launcher__icon--chat" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M12 6.2l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="currentColor" />
          </svg>
        </span>
        <span className="aw-launcher__icon aw-launcher__icon--close" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {render && (
        <section
          id="assistant-panel"
          className="aw-panel"
          data-state={open ? 'open' : 'closed'}
          role="dialog"
          aria-label={t.title}
        >
          <header className="aw-head">
            <span className="aw-head__avatar" aria-hidden="true">
              <AssistantMark size={22} />
            </span>
            <div className="aw-head__meta">
              <p className="aw-head__title">{t.title}</p>
              <p className="aw-head__status">
                <span className="aw-head__dot" aria-hidden="true" />
                {t.status}
              </p>
            </div>
            {turns.length > 0 && (
              <button
                type="button"
                className="aw-head__btn"
                aria-label={t.newChat}
                title={t.newChat}
                onClick={() => {
                  abortRef.current?.abort();
                  setTurns([]);
                  setNotice(null);
                  setToolStatus(null);
                  inputRef.current?.focus();
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 12a8 8 0 1 1 2.5 5.8M4 18v-4h4"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="aw-head__btn"
              aria-label={t.close}
              onClick={() => setOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="aw-log" role="log" aria-live="polite">
            {turns.length === 0 && !pending && (
              <div className="aw-empty">
                <span className="aw-empty__avatar" aria-hidden="true">
                  <AssistantMark size={26} />
                </span>
                <p className="aw-empty__greeting">{t.greeting}</p>
                <div className="aw-suggests">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="aw-chip"
                      disabled={!authenticated}
                      onClick={() => submit(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, i) => (
              <div key={i} className={`aw-msg aw-msg--${turn.role}`}>
                {turn.role === 'assistant' && (
                  <span className="aw-msg__avatar" aria-hidden="true">
                    <AssistantMark size={16} />
                  </span>
                )}
                <div className="aw-msg__body">
                  {turn.content !== '' && <div className="aw-bubble">{turn.content}</div>}

                  {turn.sources !== undefined && turn.sources.length > 0 && (
                    <ul className="aw-sources">
                      <li className="aw-sources__label">{t.sourcesLabel}</li>
                      {turn.sources.map((source) => (
                        <Link
                          key={source.n}
                          href={`/${locale}/help/${source.articleId}`}
                          target="_blank"
                          className="aw-source"
                        >
                          <span className="aw-source__n">[{source.n}]</span>
                          {source.title}
                        </Link>
                      ))}
                    </ul>
                  )}

                  {turn.confirmation !== undefined &&
                    (turn.confirmation.status === 'pending' || turn.confirmation.status === 'confirming') && (
                      <div className="aw-confirm">
                        <p className="aw-confirm__summary">{turn.confirmation.summary}</p>
                        <div className="aw-confirm__actions">
                          <button
                            type="button"
                            className="aw-confirm-btn aw-confirm-btn--cancel"
                            disabled={turn.confirmation.status === 'confirming'}
                            onClick={() => dismissConfirmation(i)}
                          >
                            {dict.common.cancel}
                          </button>
                          <button
                            type="button"
                            className="aw-confirm-btn aw-confirm-btn--confirm"
                            disabled={turn.confirmation.status === 'confirming'}
                            onClick={() => confirmAction(i, turn.confirmation!.token)}
                          >
                            {t.confirmButton}
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}

            {showToolStatus && (
              <div className="aw-msg aw-msg--assistant">
                <span className="aw-msg__avatar" aria-hidden="true">
                  <AssistantMark size={16} />
                </span>
                <p className="aw-tool-status">
                  <span className="aw-tool-status__dot" aria-hidden="true" />
                  {toolStatus}
                </p>
              </div>
            )}

            {showTyping && (
              <div className="aw-msg aw-msg--assistant">
                <span className="aw-msg__avatar" aria-hidden="true">
                  <AssistantMark size={16} />
                </span>
                <div className="aw-bubble aw-bubble--typing" aria-label={t.thinking}>
                  <span className="aw-typing">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}

            {notice !== null && <p className="aw-notice">{notice}</p>}
            <div ref={logEndRef} />
          </div>

          {authenticated ? (
            <form
              className="aw-composer"
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
            >
              <textarea
                ref={inputRef}
                className="aw-input"
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                maxLength={2000}
                disabled={pending}
              />
              <button
                type="submit"
                className="aw-send"
                aria-label={t.send}
                disabled={pending || input.trim() === ''}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 12l16-7-7 16-2.5-6.5L4 12z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </form>
          ) : (
            <div className="aw-signin">
              <p className="aw-signin__text">{t.signInRequired}</p>
              <Link href={`/${locale}/login`} className="aw-signin__btn">
                {dict.nav.signIn}
              </Link>
            </div>
          )}
        </section>
      )}
    </>
  );
}
