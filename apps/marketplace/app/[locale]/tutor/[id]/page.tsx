import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Card, Price, StarRating, Tag, type TagTone } from '@ermulaku/ui';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary, interpolate } from '@/i18n/dictionaries';
import {
  getAvailability,
  getMyFavoriteIds,
  getTutor,
  getTutors,
  type Slot,
} from '@/lib/queries';
import { getTokenOrDemo } from '@/lib/session';
import { upcomingDates } from '@/lib/datetime';
import { DateTabs } from '@/components/DateTabs';
import { BookingWizard } from '@/components/BookingWizard';
import { FavoriteButton } from '@/components/FavoriteButton';
import { TutorCard } from '@/components/TutorCard';

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

  const token = await getTokenOrDemo();
  const [slots, favoriteIds, similar] = await Promise.all([
    getAvailability(id, selectedDate).catch((): Slot[] => []),
    getMyFavoriteIds(token),
    // Tutors sharing the first subject, used for the "similar tutors" rail.
    getTutors({ subject: tutor.subjects[0]?.name, limit: 4 }).catch(() => ({
      items: [],
      total: 0,
      hasMore: false,
    })),
  ]);

  const isFavorited = favoriteIds.includes(id);
  const similarTutors = similar.items.filter((s) => s.id !== id).slice(0, 3);

  return (
    <div className="page profile">
      <Link href={`/${locale}/tutors`} className="profile__back">
        {t.backToList}
      </Link>

      <Card className="profile__header">
        <Avatar name={tutor.name} size="lg" />
        <div className="profile__head-main">
          <h1 className="profile__name">{tutor.name}</h1>
          {tutor.headline && <p className="profile__headline">{tutor.headline}</p>}
          {typeof tutor.rating === 'number' && (
            <StarRating value={tutor.rating} showValue count={tutor.reviewCount} />
          )}
          <p className="profile__tz">
            {tutor.timezone}
            {tutor.responseTime &&
              ` · ${interpolate(t.respondsIn, { time: tutor.responseTime })}`}
            {` · ${interpolate(t.lessonsGiven, { count: tutor.totalLessons })}`}
          </p>
          {tutor.badges.length > 0 && (
            <div className="tutor-card__badges">
              {tutor.badges.map((b) => (
                <span key={b} className="badge">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="profile__aside-head">
          <div className="profile__price">
            <Price cents={tutor.hourlyCents} currency={currency} locale={locale} unit={t.perHour} />
          </div>
          <FavoriteButton tutorId={id} initial={isFavorited} label={t.save} variant="full" />
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

          {tutor.languages.length > 0 && (
            <section className="profile__section">
              <h2 className="profile__h">{t.languages}</h2>
              <p className="profile__bio">{tutor.languages.join(' · ')}</p>
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
          <Card className="profile__section profile__booking">
            <h2 className="profile__h">{t.availability}</h2>
            <p className="profile__muted">{interpolate(t.timezoneNote, { tz: tutor.timezone })}</p>
            <DateTabs dates={dates} selected={selectedDate} locale={locale} />
            <BookingWizard
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
          </Card>
        </aside>
      </div>

      {similarTutors.length > 0 && (
        <section className="home-section">
          <div className="home-section__head">
            <h2 className="home-section__title">{t.similar}</h2>
          </div>
          <div className="tutor-grid">
            {similarTutors.map((s) => (
              <TutorCard
                key={s.id}
                tutor={s}
                locale={locale}
                currency={currency}
                dict={dict}
                favorited={favoriteIds.includes(s.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
