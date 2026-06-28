import type { JSX, ReactNode } from 'react';
import { Card } from '@ermulaku/ui';

interface KPIStatProps {
  icon: ReactNode;
  label: string;
  value: string;
  /** Optional delta pill, e.g. "+18%" / "2 new". */
  delta?: { text: string; tone: 'success' | 'danger' | 'neutral' } | undefined;
}

export function KPIStat({ icon, label, value, delta }: KPIStatProps): JSX.Element {
  return (
    <Card className="kpi">
      <div className="kpi__top">
        <span className="kpi__icon">{icon}</span>
        {delta && <span className={`kpi__delta kpi__delta--${delta.tone}`}>{delta.text}</span>}
      </div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__label">{label}</div>
    </Card>
  );
}
