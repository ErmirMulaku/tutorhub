import Link from 'next/link';
import { Avatar, Card, Price, StarRating, Tag, type TagTone } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import type { DiscoverTutor } from '@/lib/queries';
import { FavoriteButton } from './FavoriteButton';

/** Map the domain `Level` enum onto a UI tag tone. */
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

interface TutorCardProps {
  tutor: DiscoverTutor;
  locale: Locale;
  currency: string;
  dict: Dictionary;
  favorited?: boolean;
}

/** A discover-grid tile linking to the tutor's profile. */
export function TutorCard({
  tutor,
  locale,
  currency,
  dict,
  favorited = false,
}: TutorCardProps): React.JSX.Element {
  const t = dict.discover;
  const subjects = tutor.subjects.slice(0, 3);

  return (
    <Link href={`/${locale}/tutor/${tutor.id}`} className="tutor-card-link">
      <Card interactive className="tutor-card">
        <FavoriteButton tutorId={tutor.id} initial={favorited} label={dict.profile.save} />
        <div className="tutor-card__head">
          <Avatar name={tutor.name} size="lg" />
          <div className="tutor-card__id">
            <strong className="tutor-card__name">{tutor.name}</strong>
            {typeof tutor.rating === 'number' && (
              <StarRating value={tutor.rating} showValue count={tutor.reviewCount} />
            )}
          </div>
        </div>

        {tutor.headline ? (
          <p className="tutor-card__bio">{tutor.headline}</p>
        ) : (
          tutor.bio && <p className="tutor-card__bio">{tutor.bio}</p>
        )}

        {tutor.badges.length > 0 && (
          <div className="tutor-card__badges">
            {tutor.badges.map((b) => (
              <span key={b} className="badge">
                {b}
              </span>
            ))}
          </div>
        )}

        {subjects.length > 0 && (
          <div className="tutor-card__subjects">
            {subjects.map((s) => (
              <Tag key={s.id} tone={levelTone(s.level)}>
                {s.name}
              </Tag>
            ))}
          </div>
        )}

        <div className="tutor-card__meta">
          <span>{interpolate(t.lessonsGiven, { count: tutor.totalLessons })}</span>
          {tutor.responseTime && (
            <span>{interpolate(t.respondsIn, { time: tutor.responseTime })}</span>
          )}
        </div>

        <div className="tutor-card__foot">
          <Price cents={tutor.hourlyCents} currency={currency} locale={locale} unit={t.perHour} />
          <span className="tutor-card__cta">{t.viewProfile}</span>
        </div>
      </Card>
    </Link>
  );
}
