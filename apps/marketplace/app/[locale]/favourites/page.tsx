import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Card } from '@ermulaku/ui';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getMyFavorites, type DiscoverTutor } from '@/lib/queries';
import { getTokenOrDemo } from '@/lib/session';
import { TutorCard } from '@/components/TutorCard';

export default async function FavouritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.favourites;
  const currency = localeCurrency[locale];

  let tutors: DiscoverTutor[];
  try {
    tutors = await getMyFavorites(await getTokenOrDemo());
  } catch {
    tutors = [];
  }

  return (
    <div className="page">
      <header>
        <h1 className="page__title">{t.title}</h1>
        <p className="page__subtitle">{t.subtitle}</p>
      </header>

      {tutors.length > 0 ? (
        <div className="tutor-grid">
          {tutors.map((tutor) => (
            <TutorCard
              key={tutor.id}
              tutor={tutor}
              locale={locale}
              currency={currency}
              dict={dict}
              favorited
            />
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <p className="empty-state__title">{t.empty}</p>
          <p className="empty-state__sub">{t.emptySub}</p>
          <Link href={`/${locale}/tutors`}>
            <Button>{t.browse}</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
