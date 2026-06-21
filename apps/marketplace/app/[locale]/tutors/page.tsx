import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Level } from '@ermulaku/types';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary, interpolate } from '@/i18n/dictionaries';
import { getTutors } from '@/lib/queries';
import { DiscoverFilters } from '@/components/DiscoverFilters';
import { TutorCard } from '@/components/TutorCard';

function asLevel(value: string | string[] | undefined): Level | undefined {
  return typeof value === 'string' && (Object.values(Level) as string[]).includes(value)
    ? (value as Level)
    : undefined;
}

export default async function TutorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const sp = await searchParams;
  const subject = typeof sp['subject'] === 'string' ? sp['subject'] : undefined;
  const level = asLevel(sp['level']);

  const dict = getDictionary(locale);
  const t = dict.discover;
  const currency = localeCurrency[locale];

  let total = 0;
  let items: Awaited<ReturnType<typeof getTutors>>['items'] = [];
  let failed = false;
  try {
    const page = await getTutors({ subject, level });
    total = page.total;
    items = page.items;
  } catch {
    failed = true;
  }

  return (
    <div className="page">
      <header>
        <h1 className="page__title">{t.title}</h1>
        <p className="page__subtitle">{interpolate(t.subtitle, { count: total })}</p>
      </header>

      <Suspense>
        <DiscoverFilters dict={dict} />
      </Suspense>

      {items.length > 0 ? (
        <div className="tutor-grid">
          {items.map((tutor) => (
            <TutorCard
              key={tutor.id}
              tutor={tutor}
              locale={locale}
              currency={currency}
              dict={dict}
            />
          ))}
        </div>
      ) : (
        <p className="discover-empty">{failed ? t.error : t.empty}</p>
      )}
    </div>
  );
}
