import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { requireSessionToken } from '@/lib/session';
import { AssistantChat } from '@/components/AssistantChat';

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Outside any try: `redirect` signals by throwing, so a catch-all would
  // swallow it. The assistant books on the caller's account, so a session is
  // required to reach the page at all, not just to send a turn.
  await requireSessionToken(locale);

  return <AssistantChat dict={getDictionary(locale)} />;
}
