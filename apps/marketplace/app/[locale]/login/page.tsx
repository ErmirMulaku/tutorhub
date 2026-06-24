import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { AuthForm } from '@/components/AuthForm';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.auth;

  const stats = [
    { value: t.brandStat1Value, label: t.brandStat1Label },
    { value: t.brandStat2Value, label: t.brandStat2Label },
    { value: t.brandStat3Value, label: t.brandStat3Label },
  ];

  return (
    <div className="auth-split">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand__rings" />
        <div className="auth-brand__content">
          <div className="auth-brand__logo">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" opacity="0.4" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            <span>
              Tutor<span className="auth-brand__logo-accent">Hub</span>
            </span>
          </div>
          <h2 className="auth-brand__headline">{t.brandHeadline}</h2>
          <div className="auth-brand__stats">
            {stats.map((s) => (
              <div key={s.label} className="auth-brand__stat">
                <span className="auth-brand__stat-value">{s.value}</span>
                <span className="auth-brand__stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="auth-pane">
        <AuthForm locale={locale} dict={dict} />
      </div>
    </div>
  );
}
