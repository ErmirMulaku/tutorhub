import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getHelpArticle } from '@/lib/queries';

/** `**bold**` only — the help articles never use headers, lists, or links. */
function renderParagraph(text: string, key: number): React.JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p key={key} className="help-article__p">
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<React.JSX.Element> {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const article = await getHelpArticle(id);
  if (article === null) notFound();

  const paragraphs = article.body.split(/\n\n+/);

  return (
    <main className="help-article">
      <Link href={`/${locale}`} className="help-article__back">
        {dict.common.back}
      </Link>
      <h1 className="help-article__title">{article.title}</h1>
      <div className="help-article__body">
        {paragraphs.map((p, i) => renderParagraph(p, i))}
      </div>
    </main>
  );
}
