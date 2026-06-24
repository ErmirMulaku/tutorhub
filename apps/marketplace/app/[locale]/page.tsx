import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Card } from '@ermulaku/ui';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary, interpolate } from '@/i18n/dictionaries';
import { getTutors } from '@/lib/queries';
import { TutorCard } from '@/components/TutorCard';

/** Subject keyword each home category searches for in the discover grid. */
const CATEGORY_QUERY: Record<string, string> = {
  academic: 'Math',
  languages: 'Mandarin',
  music: 'Guitar',
  humanities: 'History',
  coding: 'Computer',
  testprep: 'Physics',
};

/** Per-category glyph, colour tone and indicative tutor count (from the design). */
const CATEGORY_META: Record<string, { glyph: string; tone: string; count: number }> = {
  academic: { glyph: '∑', tone: 'teal', count: 670 },
  languages: { glyph: '文', tone: 'rose', count: 540 },
  music: { glyph: '♪', tone: 'amber', count: 340 },
  humanities: { glyph: '✎', tone: 'violet', count: 420 },
  coding: { glyph: '</>', tone: 'blue', count: 210 },
  testprep: { glyph: '✓', tone: 'green', count: 300 },
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.home;
  const currency = localeCurrency[locale];

  const featured = await getTutors({ sort: 'rating', limit: 4 }).catch(() => ({
    items: [],
    total: 0,
    hasMore: false,
  }));

  const categories = Object.keys(CATEGORY_QUERY) as Array<keyof typeof dict.categories>;

  const testimonials = [
    { quote: t.feature1Body, name: 'Aisha M.', role: 'Maths · A-level' },
    { quote: t.feature2Body, name: 'Tom R.', role: 'Guitar · Beginner' },
    { quote: t.feature3Body, name: 'Lena K.', role: 'Mandarin · HSK 3' },
  ];

  return (
    <>
      <div className="hero-wrap">
        <section className="hero">
          <h1 className="hero__title">{t.heroTitle}</h1>
          <p className="hero__subtitle">{t.heroSubtitle}</p>
          <div className="hero__actions">
            <Link href={`/${locale}/tutors`}>
              <Button size="lg">{t.ctaBrowse}</Button>
            </Link>
            <Link href="#how" className="hero__link">
              {t.ctaHow}
            </Link>
          </div>
        </section>

        <section className="trust" aria-label={t.categoriesTitle}>
          <div className="trust__cell">
            <span className="trust__value">
              {t.trustRatingValue}
              <span className="trust__star" aria-hidden="true">
                ★
              </span>
            </span>
            <span className="trust__label">{t.trustRatingLabel}</span>
          </div>
          <div className="trust__cell">
            <span className="trust__value">{t.trustSubjectsValue}</span>
            <span className="trust__label">{t.trustSubjectsLabel}</span>
          </div>
          <div className="trust__cell">
            <span className="trust__value">{t.trustTutorsValue}</span>
            <span className="trust__label">{t.trustTutorsLabel}</span>
          </div>
        </section>
      </div>

      <section className="home-section" aria-labelledby="cat-h">
        <div className="home-section__head">
          <div>
            <h2 id="cat-h" className="home-section__title">
              {t.categoriesTitle}
            </h2>
            <p className="home-section__subtitle">{t.categoriesSubtitle}</p>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((key) => {
            const meta = CATEGORY_META[key];
            return (
              <Link
                key={key}
                href={`/${locale}/tutors?query=${encodeURIComponent(CATEGORY_QUERY[key] as string)}`}
                className="category-card"
              >
                <span className="category-card__icon" data-tone={meta?.tone} aria-hidden="true">
                  {meta?.glyph}
                </span>
                <span className="category-card__label">{dict.categories[key]}</span>
                <span className="category-card__count">
                  {interpolate(t.categoryTutors, {
                    count: new Intl.NumberFormat(locale).format(meta?.count ?? 0),
                  })}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {featured.items.length > 0 && (
        <section className="home-section" aria-labelledby="feat-h">
          <div className="home-section__head">
            <div>
              <h2 id="feat-h" className="home-section__title">
                {t.featuredTitle}
              </h2>
              <p className="home-section__subtitle">{t.featuredSubtitle}</p>
            </div>
            <Link href={`/${locale}/tutors`} className="home-section__more">
              {t.viewAll}
            </Link>
          </div>
          <div className="tutor-grid">
            {featured.items.map((tutor) => (
              <TutorCard
                key={tutor.id}
                tutor={tutor}
                locale={locale}
                currency={currency}
                dict={dict}
              />
            ))}
          </div>
        </section>
      )}

      <section className="home-section" id="how" aria-labelledby="how-h">
        <div className="home-section__head">
          <div>
            <h2 id="how-h" className="home-section__title">
              {t.howTitle}
            </h2>
            <p className="home-section__subtitle">{t.howSubtitle}</p>
          </div>
        </div>
        <div className="features">
          {[
            { n: 1, title: t.how1Title, body: t.how1Body },
            { n: 2, title: t.how2Title, body: t.how2Body },
            { n: 3, title: t.how3Title, body: t.how3Body },
          ].map((step) => (
            <Card key={step.n} className="step-card">
              <span className="step-card__num">{step.n}</span>
              <h3 className="feature__title">{step.title}</h3>
              <p className="feature__body">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="testi-h">
        <div className="home-section__head">
          <h2 id="testi-h" className="home-section__title">
            {t.testiTitle}
          </h2>
        </div>
        <div className="features">
          {testimonials.map((item) => (
            <Card key={item.name} className="testi-card">
              <p className="testi-card__quote">“{item.quote}”</p>
              <p className="testi-card__author">
                <strong>{item.name}</strong> · {item.role}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
