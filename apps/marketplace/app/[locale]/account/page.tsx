import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getMe } from '@/lib/queries';
import { getTokenOrDemo } from '@/lib/session';
import { AccountView } from '@/components/AccountView';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.account;

  const me = await getMe(await getTokenOrDemo()).catch(() => null);
  if (!me) redirect(`/${locale}/login`);

  return (
    <div className="page">
      <header>
        <h1 className="page__title">{t.title}</h1>
        <p className="page__subtitle">{t.subtitle}</p>
      </header>
      <AccountView me={me} dict={dict} />
    </div>
  );
}
