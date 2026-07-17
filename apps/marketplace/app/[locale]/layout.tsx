import type { CSSProperties, ReactNode } from 'react';
import { cookies } from 'next/headers';
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
import { AssistantWidget } from '@/components/AssistantWidget';
import { Header } from '@/components/Header';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { getMe, getNotifications } from '@/lib/queries';
import { getSessionToken } from '@/lib/session';

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
  // Identity comes from the session cookie alone — no guest fallback — so signing
  // out really renders the signed-out header. Also never hard-crash if the API is
  // unreachable: degrade to the signed-out state instead.
  let me: Awaited<ReturnType<typeof getMe>> = null;
  let feed: Awaited<ReturnType<typeof getNotifications>> = { items: [], unread: 0 };
  const token = await getSessionToken();
  if (token !== null) {
    try {
      [me, feed] = await Promise.all([getMe(token), getNotifications(token)]);
    } catch {
      me = null;
    }
  }

  // Lead the font stack with the script that matches the locale.
  const fontStack =
    locale === 'ar'
      ? 'var(--font-noto-arabic), var(--font-hanken), system-ui, sans-serif'
      : 'var(--font-hanken), var(--font-noto-arabic), system-ui, sans-serif';

  // Server-render the persisted theme so returning users see no flash; the
  // inline script below covers first visits (system preference) before paint.
  const themeCookie = (await cookies()).get('th_theme')?.value;
  const themeScript =
    "(function(){try{var m=document.cookie.match(/(?:^|; )th_theme=(dark|light)/);" +
    "var t=m?m[1]:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');" +
    "if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();";

  return (
    <html
      lang={locale}
      dir={direction[locale]}
      data-theme={themeCookie === 'dark' ? 'dark' : undefined}
      className={`${hanken.variable} ${notoArabic.variable}`}
      style={{ '--th-font': fontStack } as CSSProperties}
      // The inline script may set data-theme from system preference before
      // hydration; that's an intentional pre-paint mutation, not a bug.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ServiceWorkerRegister />
        <Header
          locale={locale}
          dict={dict}
          userName={me?.fullName ?? null}
          userEmail={me?.email ?? null}
          notifications={feed.items}
          unread={feed.unread}
        />
        <main className="container">{children}</main>
        {/* Global floating assistant. `me !== null` matches the header's own
            logged-in check, so a stale token counts as signed out. */}
        <AssistantWidget dict={dict} locale={locale} authenticated={me !== null} />
      </body>
    </html>
  );
}
