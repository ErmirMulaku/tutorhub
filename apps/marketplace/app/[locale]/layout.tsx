import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '@ermulaku/ui/styles.css';
import '../globals.css';
import { direction, isLocale, locales } from '@/i18n/config';
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

  return (
    <html lang={locale} dir={direction[locale]}>
      <body>
        <ServiceWorkerRegister />
        <Header locale={locale} dict={dict} userName={me?.fullName ?? null} />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
