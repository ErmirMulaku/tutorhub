import type { JSX } from 'react';
import { Card } from '@ermulaku/ui';

/** Temporary titled empty state for modules not yet built (Phase 0 scaffolding). */
export function Placeholder({ title }: { title: string }): JSX.Element {
  return (
    <Card>
      <h2 style={{ margin: '0 0 .25rem', fontSize: '1.05rem' }}>{title}</h2>
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        This screen is coming together in a later phase.
      </p>
    </Card>
  );
}
