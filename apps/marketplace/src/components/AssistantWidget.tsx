'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { assistantChatAction } from '@/lib/actions';
import type { AssistantTurn } from '@/lib/queries';

/** Other components (e.g. the header link) open the widget by firing this. */
export const ASSISTANT_OPEN_EVENT = 'tutorhub:assistant-open';

interface Shown extends AssistantTurn {
  /** Tools the model ran for this reply, shown so its actions aren't invisible. */
  toolsUsed?: string[];
}

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
 * Floating booking-assistant widget.
 *
 * A launcher pinned to the bottom of the reading edge opens a chat panel on
 * every page. The model can book a real lesson on the signed-in student's
 * account, so the tools it ran are shown beneath each reply and a signed-out
 * visitor is prompted to sign in rather than sending a turn. Turns go through a
 * server action, keeping the session token out of the browser.
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
  const [turns, setTurns] = useState<Shown[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  }, [turns, pending, render]);

  const submit = useCallback(
    (content: string): void => {
      const text = content.trim();
      if (text === '' || pending) return;

      // The API takes the whole history each turn; it holds no conversation state.
      const history: Shown[] = [...turns, { role: 'user', content: text }];
      setTurns(history);
      setInput('');
      setNotice(null);

      startTransition(() => {
        void assistantChatAction(
          history.map(({ role, content: c }) => ({ role, content: c })),
        ).then((res) => {
          if (!res.ok) {
            setNotice(
              res.reason === 'UNAVAILABLE'
                ? t.unavailable
                : res.reason === 'RATE_LIMITED'
                  ? t.rateLimited
                  : res.reason === 'NOT_AUTHENTICATED'
                    ? t.signInRequired
                    : t.failed,
            );
            return;
          }
          setTurns([
            ...history,
            { role: 'assistant', content: res.reply, toolsUsed: res.toolsUsed },
          ]);
          // A turn may have booked a lesson; refresh so /lessons isn't stale.
          if (res.toolsUsed.includes('bookLesson')) router.refresh();
        });
      });
    },
    [pending, turns, t, router],
  );

  const suggestions = [t.suggest1, t.suggest2, t.suggest3];

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
                  setTurns([]);
                  setNotice(null);
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
                <p className="aw-empty__hint">{t.subtitle}</p>
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
                  <div className="aw-bubble">{turn.content}</div>
                  {turn.toolsUsed !== undefined && turn.toolsUsed.length > 0 && (
                    <p className="aw-tools">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M9 12l2 2 4-4"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {interpolate(t.toolsUsed, { tools: turn.toolsUsed.join(', ') })}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {pending && (
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
