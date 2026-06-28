import type { JSX } from 'react';
import { useToast } from './ToastProvider';

/** Dashed promo-code chip with a copy-to-clipboard action. */
export function CodeChip({ code }: { code: string }): JSX.Element {
  const toast = useToast();
  return (
    <button
      type="button"
      className="codechip"
      onClick={() => {
        void navigator.clipboard?.writeText(code);
        toast(`Copied ${code}`);
      }}
      title="Copy code"
    >
      <span className="codechip__code">{code}</span>
      <span className="codechip__icon" aria-hidden>
        ⧉
      </span>
    </button>
  );
}
