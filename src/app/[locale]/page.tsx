// ============================================================
// Кассандра — Лендинг
// Главная страница платформы (до авторизации)
// ============================================================
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { LanguageRedirect } from '@/components/LanguageRedirect';

export default async function HomePage() {
  const t = await getTranslations('landing');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  let stats = {
    totalUsers: 0,
    totalMatches: 0,
    weeklyMatches: 0,
    globalCoherence: null as number | null,
    topMatches: [] as Array<{ id: string; score: number; eventTitle: string; quote: string; username: string }>,
  };
  try {
    const res = await fetch(`${baseUrl}/api/landing-stats`, { cache: 'no-store' });
    if (res.ok) stats = await res.json();
  } catch {}

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <LanguageRedirect />

      <header className="border-b border-border backdrop-blur bg-background/90 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-sm">К</span>
            </div>
            <span className="text-xl font-bold">Кассандра</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-text-secondary hover:text-text-primary transition-colors">
              {t('login')}
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              {t('register')}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 pt-14 pb-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border mb-6 text-sm text-text-secondary">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-slow" />
                {t('badge')}
              </div>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-5">
                {t('title1')}
                <br />
                <span className="text-primary">{t('title2')}</span>
              </h1>
              <p className="text-lg text-text-secondary max-w-xl mb-8">{t('desc')}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary text-base px-7 py-3">{t('cta')}</Link>
                <a href="#how-it-works" className="btn-secondary text-base px-7 py-3">{t('howItWorks')}</a>
              </div>
            </div>

            <div className="card p-6 h-[360px] relative overflow-hidden">
              <div className="absolute inset-0 shimmer-bg opacity-60" />
              <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-4">{t('liveMapTitle')}</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-surface-hover rounded-xl p-3">
                    <p className="text-xs text-text-muted">{t('metricUsers')}</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  </div>
                  <div className="bg-surface-hover rounded-xl p-3">
                    <p className="text-xs text-text-muted">{t('metricMatches')}</p>
                    <p className="text-2xl font-bold text-match">{stats.totalMatches}</p>
                  </div>
                </div>
                <div className="h-40 rounded-xl bg-surface-hover border border-border flex items-center justify-center text-text-muted text-sm">
                  {t('liveMapPlaceholder')}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-5">{t('socialProof')}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-text-muted">{t('metricUsers')}</p>
              <p className="text-3xl font-bold">{stats.totalUsers}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-muted">{t('metricMatches')}</p>
              <p className="text-3xl font-bold text-match">{stats.totalMatches}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-muted">{t('metricWeekly')}</p>
              <p className="text-3xl font-bold text-primary">{stats.weeklyMatches}</p>
            </div>
          </div>
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            {stats.topMatches.map((m) => (
              <div key={m.id} className="card p-4">
                <p className="text-sm text-text-secondary line-clamp-3">&ldquo;{m.quote}&rdquo;</p>
                <p className="text-xs text-text-muted mt-3">@{m.username}</p>
                <p className="text-sm font-medium mt-1 line-clamp-1">{m.eventTitle}</p>
                <p className="text-xs text-match mt-1">{Math.round(m.score * 100)}%</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="max-w-7xl mx-auto px-4 py-14">
          <h2 className="text-3xl font-bold text-center mb-10">{t('howItWorks')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card text-center p-6">
              <div className="w-14 h-14 rounded-xl bg-dream/10 border border-dream/20 flex items-center justify-center mx-auto mb-4">🌙</div>
              <h3 className="text-lg font-semibold mb-2">{t('step1.title')}</h3>
              <p className="text-text-secondary text-sm">{t('step1.desc')}</p>
            </div>
            <div className="card text-center p-6">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">🧠</div>
              <h3 className="text-lg font-semibold mb-2">{t('step2.title')}</h3>
              <p className="text-text-secondary text-sm">{t('step2.desc')}</p>
            </div>
            <div className="card text-center p-6">
              <div className="w-14 h-14 rounded-xl bg-match/10 border border-match/20 flex items-center justify-center mx-auto mb-4">✨</div>
              <h3 className="text-lg font-semibold mb-2">{t('step3.title')}</h3>
              <p className="text-text-secondary text-sm">{t('step3.desc')}</p>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 pb-16">
          <div className="card p-8 text-center">
            <h2 className="text-3xl font-bold mb-3">{t('finalCtaTitle')}</h2>
            <p className="text-text-secondary mb-6">{t('footer')}</p>
            <Link href="/register" className="btn-primary px-8 py-3 text-base">{t('cta')}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-7 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm text-text-muted">Кассандра © 2026</span>
          <span className="text-xs text-text-muted">{t('disclaimer')}</span>
        </div>
      </footer>
    </div>
  );
}
