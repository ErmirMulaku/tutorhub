import { notFound } from 'next/navigation';
import { isLocale, localeCurrency } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getWallet, type Wallet } from '@/lib/queries';
import { getTokenOrDemo } from '@/lib/session';
import { WalletView } from '@/components/WalletView';

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.wallet;
  const currency = localeCurrency[locale];

  let wallet: Wallet = { balanceCents: 0, giftCards: [], paymentMethods: [] };
  try {
    wallet = await getWallet(await getTokenOrDemo());
  } catch {
    // Render an empty wallet rather than 500 the page.
  }

  return (
    <div className="page">
      <header>
        <h1 className="page__title">{t.title}</h1>
        <p className="page__subtitle">{t.subtitle}</p>
      </header>
      <WalletView wallet={wallet} locale={locale} currency={currency} dict={dict} />
    </div>
  );
}
