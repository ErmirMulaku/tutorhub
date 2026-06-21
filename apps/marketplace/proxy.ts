import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, locales, type Locale } from '@/i18n/config';

/** Pick the best supported locale from the `Accept-Language` header. */
function negotiateLocale(request: NextRequest): Locale {
  const header = request.headers.get('accept-language');
  if (!header) return defaultLocale;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().split('-')[0]?.toLowerCase() ?? '';
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

/**
 * Redirect any locale-less path to a locale-prefixed one. (Next 16's `proxy`
 * file convention, formerly `middleware`.)
 */
export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return undefined;

  const locale = negotiateLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes, and anything with a file extension.
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
