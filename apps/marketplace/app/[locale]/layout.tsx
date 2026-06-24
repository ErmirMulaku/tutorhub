import type { CSSProperties, ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Noto_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import '@ermulaku/ui/styles.css';
import '../globals.css';
import { direction, isLocale, locales } from '@/i18n/config';

// Latin + Arabic faces from the design spec, exposed as CSS variables so the
// `--th-font` token can lead with the right script per locale.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
});
const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-noto-arabic',
  display: 'swap',
});
import { getDictionary } from '@/i18n/dictionaries';
import { Header } from '@/components/Header';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { getMe } from '@/lib/queries';
import { getTokenOrDemo } from '@/lib/session';

export const metadata: Metadata = {
  title: 'TutorHub — find and book a tutor',
  description: 'Browse expert tutors with real-time availability and book a lesson in seconds.',
  applicationName: 'TutorHub',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'TutorHub' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#0e8f8a',
};

/** Pre-render both locales at build time. */
export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  // The header must never hard-crash if the API is unreachable: degrade to the
  // logged-out state instead. `getTokenOrDemo` itself can throw (dev-login fetch).
  let me: Awaited<ReturnType<typeof getMe>>;
  try {
    me = await getMe(await getTokenOrDemo());
  } catch {
    me = null;
  }

  // Lead the font stack with the script that matches the locale.
  const fontStack =
    locale === 'ar'
      ? 'var(--font-noto-arabic), var(--font-hanken), system-ui, sans-serif'
      : 'var(--font-hanken), var(--font-noto-arabic), system-ui, sans-serif';

  return (
    <html
      lang={locale}
      dir={direction[locale]}
      className={`${hanken.variable} ${notoArabic.variable}`}
      style={{ '--th-font': fontStack } as CSSProperties}
    >
      <body>
        <ServiceWorkerRegister />
        <Header locale={locale} dict={dict} userName={me?.fullName ?? null} />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
