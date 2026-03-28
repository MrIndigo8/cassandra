import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'legal' });
  return { title: `${t('privacyTitle')} — Cassandra` };
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  return (
    <article className="card glass p-6 md:p-8 space-y-4 text-text-secondary text-sm leading-relaxed">
      <h1 className="text-2xl font-bold text-text-primary">{t('privacyTitle')}</h1>
      <p>{t('privacyP1')}</p>
      <p>{t('privacyP2')}</p>
      <p>{t('privacyP3')}</p>
      <p className="text-text-muted text-xs pt-4 border-t border-border">{t('privacyFooter')}</p>
      <p>
        <Link href="/login" className="text-primary hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </article>
  );
}
