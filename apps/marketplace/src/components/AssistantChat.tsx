'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ermulaku/ui';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { assistantChatAction } from '@/lib/actions';
import type { AssistantTurn } from '@/lib/queries';

interface Shown extends AssistantTurn {
  /** Tools the model ran for this reply, shown so its actions aren't invisible. */
  toolsUsed?: string[];
}

/**
 * Chat with the booking assistant.
 *
 * The model can book a real lesson on the signed-in student's account, so the
 * tools it ran are shown beneath each reply rather than hidden: a booking should
 * never be the first the student hears of it. The turn goes through a server
 * action, keeping the session token out of the browser.
 */
export function AssistantChat({ dict }: { dict: Dictionary }): React.JSX.Element {
  const t = dict.assistant;
  const router = useRouter();
  const [turns, setTurns] = useState<Shown[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending]);

  function send(e: React.FormEvent): void {
    e.preventDefault();
    const content = input.trim();
    if (content === '' || pending) return;

    // The API takes the whole history each turn; it holds no conversation state.
    const history: Shown[] = [...turns, { role: 'user', content }];
    setTurns(history);
    setInput('');
    setNotice(null);

    startTransition(() => {
      void assistantChatAction(history.map(({ role, content: c }) => ({ role, content: c }))).then(
        (res) => {
          if (!res.ok) {
            setNotice(
              res.reason === 'UNAVAILABLE'
                ? t.unavailable
                : res.reason === 'RATE_LIMITED'
                  ? t.rateLimited
                  : t.failed,
            );
            return;
          }
          setTurns([...history, { role: 'assistant', content: res.reply, toolsUsed: res.toolsUsed }]);
          // A turn may have booked a lesson; refresh so /lessons isn't stale.
          if (res.toolsUsed.includes('bookLesson')) router.refresh();
        },
      );
    });
  }

  return (
    <section className="assistant">
      <header className="assistant__head">
        <h1 className="assistant__title">{t.title}</h1>
        <p className="assistant__sub">{t.subtitle}</p>
        <p className="assistant__warn">{t.books}</p>
      </header>

      <div className="assistant__log" role="log" aria-live="polite">
        {turns.length === 0 && !pending && <p className="assistant__empty">{t.empty}</p>}

        {turns.map((turn, i) => (
          <article key={i} className={`assistant__turn assistant__turn--${turn.role}`}>
            <span className="assistant__who">{turn.role === 'user' ? t.you : t.assistant}</span>
            <p className="assistant__text">{turn.content}</p>
            {turn.toolsUsed !== undefined && turn.toolsUsed.length > 0 && (
              <p className="assistant__tools">
                {interpolate(t.toolsUsed, { tools: turn.toolsUsed.join(', ') })}
              </p>
            )}
          </article>
        ))}

        {pending && <p className="assistant__thinking">{t.thinking}</p>}
        {notice !== null && <p className="assistant__notice">{notice}</p>}
        <div ref={endRef} />
      </div>

      <form className="assistant__form" onSubmit={send}>
        <input
          className="assistant__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          maxLength={2000}
          disabled={pending}
        />
        <Button type="submit" disabled={pending || input.trim() === ''}>
          {pending ? t.thinking : t.send}
        </Button>
      </form>

      {turns.length > 0 && (
        <button
          type="button"
          className="assistant__reset"
          onClick={() => {
            setTurns([]);
            setNotice(null);
          }}
        >
          {t.reset}
        </button>
      )}
    </section>
  );
}
