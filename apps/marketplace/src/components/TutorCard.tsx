import Link from 'next/link';
import { Avatar, Card, Price, StarRating, Tag, type TagTone } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { DiscoverTutor } from '@/lib/queries';

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
}

/** A discover-grid tile linking to the tutor's profile. */
export function TutorCard({ tutor, locale, currency, dict }: TutorCardProps): React.JSX.Element {
  const t = dict.discover;
  const subjects = tutor.subjects.slice(0, 3);

  return (
    <Link href={`/${locale}/tutor/${tutor.id}`} className="tutor-card-link">
      <Card interactive className="tutor-card">
        <div className="tutor-card__head">
          <Avatar name={tutor.name} size="lg" />
          <div className="tutor-card__id">
            <strong className="tutor-card__name">{tutor.name}</strong>
            {typeof tutor.rating === 'number' && (
              <StarRating value={tutor.rating} showValue />
            )}
          </div>
        </div>

        {tutor.bio && <p className="tutor-card__bio">{tutor.bio}</p>}

        {subjects.length > 0 && (
          <div className="tutor-card__subjects">
            {subjects.map((s) => (
              <Tag key={s.id} tone={levelTone(s.level)}>
                {s.name}
              </Tag>
            ))}
          </div>
        )}

        <div className="tutor-card__foot">
          <Price cents={tutor.hourlyCents} currency={currency} locale={locale} unit={t.perHour} />
          <span className="tutor-card__cta">{t.viewProfile}</span>
        </div>
      </Card>
    </Link>
  );
}
