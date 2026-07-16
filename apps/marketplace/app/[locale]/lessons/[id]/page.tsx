import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getAvailability, getMyBookings, type Slot } from '@/lib/queries';
import { requireSessionToken } from '@/lib/session';
import { upcomingDates } from '@/lib/datetime';
import { LessonDetailView } from '@/components/LessonDetailView';

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<React.JSX.Element> {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.lessons;
  const currency = localeCurrency[locale];

  const token = await requireSessionToken(locale);
  const bookings = await getMyBookings(token).catch(() => []);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) notFound();

  // Pre-fetch a week of availability so the inline reschedule panel can switch
  // days without a round-trip.
  const dates = upcomingDates(7);
  const slotLists = await Promise.all(
    dates.map((d) => getAvailability(booking.tutor.id, d).catch((): Slot[] => [])),
  );
  const slotsByDate: Record<string, Slot[]> = {};
  dates.forEach((d, i) => {
    slotsByDate[d] = slotLists[i] ?? [];
  });

  return (
    <div className="page lesson-detail">
      <Link href={`/${locale}/lessons`} className="lesson-detail__back">
        {t.detailBack}
      </Link>
      <LessonDetailView
        booking={booking}
        dates={dates}
        slotsByDate={slotsByDate}
        locale={locale}
        currency={currency}
        dict={dict}
      />
    </div>
  );
}
