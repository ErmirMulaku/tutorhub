import Link from 'next/link';
import { Button, Card } from '@ermulaku/ui';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { notFound } from 'next/navigation';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.home;

  const features = [
    { title: t.feature1Title, body: t.feature1Body },
    { title: t.feature2Title, body: t.feature2Body },
    { title: t.feature3Title, body: t.feature3Body },
  ];

  return (
    <>
      <section className="hero">
        <h1 className="hero__title">{t.heroTitle}</h1>
        <p className="hero__subtitle">{t.heroSubtitle}</p>
        <div className="hero__actions">
          <Link href={`/${locale}/tutors`}>
            <Button size="lg">{t.ctaBrowse}</Button>
          </Link>
        </div>
      </section>

      <section className="features" aria-label="Why TutorHub">
        {features.map((f) => (
          <Card key={f.title}>
            <h2 className="feature__title">{f.title}</h2>
            <p className="feature__body">{f.body}</p>
          </Card>
        ))}
      </section>
    </>
  );
}
