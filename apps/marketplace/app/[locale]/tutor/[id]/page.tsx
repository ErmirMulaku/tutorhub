import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Card, Price, StarRating, Tag, type TagTone } from '@ermulaku/ui';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary, interpolate } from '@/i18n/dictionaries';
import { getAvailability, getTutor, type Slot } from '@/lib/queries';
import { upcomingDates } from '@/lib/datetime';
import { DateTabs } from '@/components/DateTabs';
import { BookingPanel } from '@/components/BookingPanel';

function levelTone(level: string): TagTone {
  switch (level) {
    case 'BEGINNER':
      return 'beginner';
    case 'INTERMEDIATE':
      return 'intermediate';
    case 'ADVANCED':
      return 'advanced';
    default:
      return 'neutral';
  }
}

export default async function TutorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.profile;
  const currency = localeCurrency[locale];

  const tutor = await getTutor(id).catch(() => null);
  if (!tutor) notFound();

  const dates = upcomingDates(7);
  const sp = await searchParams;
  const selectedDate =
    typeof sp['date'] === 'string' && dates.includes(sp['date']) ? sp['date'] : (dates[0] as string);

  let slots: Slot[];
  try {
    slots = await getAvailability(id, selectedDate);
  } catch {
    slots = [];
  }

  return (
    <div className="page profile">
      <Link href={`/${locale}/tutors`} className="profile__back">
        {t.backToList}
      </Link>

      <Card className="profile__header">
        <Avatar name={tutor.name} size="lg" />
        <div className="profile__head-main">
          <h1 className="profile__name">{tutor.name}</h1>
          {typeof tutor.rating === 'number' && (
            <StarRating value={tutor.rating} showValue count={tutor.reviews.length} />
          )}
          <p className="profile__tz">{tutor.timezone}</p>
        </div>
        <div className="profile__price">
          <Price cents={tutor.hourlyCents} currency={currency} locale={locale} unit={t.perHour} />
        </div>
      </Card>

      <div className="profile__grid">
        <div className="profile__col">
          {tutor.bio && (
            <section className="profile__section">
              <h2 className="profile__h">{t.about}</h2>
              <p className="profile__bio">{tutor.bio}</p>
            </section>
          )}

          {tutor.subjects.length > 0 && (
            <section className="profile__section">
              <h2 className="profile__h">{t.subjects}</h2>
              <div className="profile__tags">
                {tutor.subjects.map((s) => (
                  <Tag key={s.id} tone={levelTone(s.level)}>
                    {s.name}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          <section className="profile__section">
            <h2 className="profile__h">{t.reviews}</h2>
            {tutor.reviews.length > 0 ? (
              <ul className="reviews">
                {tutor.reviews.map((r) => (
                  <li key={r.id} className="review">
                    <StarRating value={r.rating} />
                    {r.comment && <p className="review__comment">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile__muted">{t.noReviews}</p>
            )}
          </section>
        </div>

        <aside className="profile__col">
          <section className="profile__section">
            <h2 className="profile__h">{t.availability}</h2>
            <p className="profile__muted">{interpolate(t.timezoneNote, { tz: tutor.timezone })}</p>
            <DateTabs dates={dates} selected={selectedDate} locale={locale} />
            <BookingPanel
              tutorId={tutor.id}
              tutorName={tutor.name}
              timezone={tutor.timezone}
              hourlyCents={tutor.hourlyCents}
              subjects={tutor.subjects}
              slots={slots}
              locale={locale}
              currency={currency}
              dict={dict}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
