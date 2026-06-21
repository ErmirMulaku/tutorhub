'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { formatDayTab } from '@/lib/datetime';

interface DateTabsProps {
  dates: string[];
  selected: string;
  locale: Locale;
}

/** Day selector for availability — writes `?date=` so the server refetches slots. */
export function DateTabs({ dates, selected, locale }: DateTabsProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const pick = (date: string): void => {
    const next = new URLSearchParams(params.toString());
    next.set('date', date);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className="date-tabs" role="tablist">
      {dates.map((date) => (
        <button
          key={date}
          type="button"
          role="tab"
          aria-selected={date === selected}
          className="date-tab"
          data-active={date === selected}
          onClick={() => pick(date)}
        >
          {formatDayTab(date, locale)}
        </button>
      ))}
    </div>
  );
}
