import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@ermulaku/ui';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getMyBookings, type MyBooking } from '@/lib/queries';
import { getTokenOrDemo } from '@/lib/session';
import { LessonsView } from '@/components/LessonsView';

export default async function LessonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.lessons;

  let bookings: MyBooking[];
  try {
    bookings = await getMyBookings(await getTokenOrDemo());
  } catch {
    bookings = [];
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page__title">{t.title}</h1>
          <p className="page__subtitle">{t.subtitle}</p>
        </div>
        <Link href={`/${locale}/tutors`}>
          <Button variant="secondary">{t.browse}</Button>
        </Link>
      </header>

      <LessonsView bookings={bookings} locale={locale} dict={dict} />
    </div>
  );
}
