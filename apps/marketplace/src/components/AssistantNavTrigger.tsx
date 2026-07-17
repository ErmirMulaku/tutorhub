'use client';

import { ASSISTANT_OPEN_EVENT } from './AssistantWidget';

/**
 * Header entry that opens the floating booking assistant. It's a button, not a
 * link: the assistant lives in a global widget rather than on its own page, so
 * this just fires the open event the widget listens for.
 */
export function AssistantNavTrigger({ label }: { label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="site-header__nav-link site-header__nav-link--assistant"
      onClick={() => window.dispatchEvent(new Event(ASSISTANT_OPEN_EVENT))}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path d="M12 6.2l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="currentColor" />
      </svg>
      {label}
    </button>
  );
}
