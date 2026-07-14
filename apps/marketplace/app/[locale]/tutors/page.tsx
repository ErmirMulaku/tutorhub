import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Level } from '@ermulaku/types';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary, interpolate } from '@/i18n/dictionaries';
import { getMyFavoriteIds, getTutors, type TutorSort } from '@/lib/queries';
import { getSessionToken } from '@/lib/session';
import { DiscoverFilters } from '@/components/DiscoverFilters';
import { TutorCard } from '@/components/TutorCard';

function asLevel(value: string | string[] | undefined): Level | undefined {
  return typeof value === 'string' && (Object.values(Level) as string[]).includes(value)
    ? (value as Level)
    : undefined;
}

function asSort(value: string | string[] | undefined): TutorSort | undefined {
  const sorts: TutorSort[] = ['relevance', 'priceAsc', 'priceDesc', 'rating'];
  return typeof value === 'string' && (sorts as string[]).includes(value)
    ? (value as TutorSort)
    : undefined;
}

function asNumber(value: string | string[] | undefined): number | undefined {
  if (typeof value !== 'string') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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
  const query = typeof sp['query'] === 'string' ? sp['query'] : undefined;
  const subject = typeof sp['subject'] === 'string' ? sp['subject'] : undefined;
  const level = asLevel(sp['level']);
  const maxPrice = asNumber(sp['maxPrice']);
  const minRating = asNumber(sp['minRating']);
  const sort = asSort(sp['sort']);

  const dict = getDictionary(locale);
  const t = dict.discover;
  const currency = localeCurrency[locale];

  let total = 0;
  let items: Awaited<ReturnType<typeof getTutors>>['items'] = [];
  let failed = false;
  let favoriteIds: string[] = [];
  try {
    // Discover stays public: favourites are only personalised when signed in.
    const token = await getSessionToken();
    const [page, favs] = await Promise.all([
      getTutors({ subject, query, level, maxPrice, minRating, sort }),
      token === null ? Promise.resolve<string[]>([]) : getMyFavoriteIds(token),
    ]);
    total = page.total;
    items = page.items;
    favoriteIds = favs;
  } catch {
    failed = true;
  }

  const favSet = new Set(favoriteIds);

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
              favorited={favSet.has(tutor.id)}
            />
          ))}
        </div>
      ) : (
        <p className="discover-empty">{failed ? t.error : t.empty}</p>
      )}
    </div>
  );
}
