// ============================================================
// Кассандра — Лендинг
// Главная страница платформы (до авторизации)
// ============================================================
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { LanguageRedirect } from '@/components/LanguageRedirect';
import { Logo } from '@/components/layout/Logo';

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
    <div className="app-shell min-h-screen text-text-primary">
      <LanguageRedirect />

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9 shrink-0 drop-shadow-[0_0_14px_rgba(167,139,250,0.4)]" aria-hidden />
            <span className="text-xl font-display font-bold tracking-tight">Кассандра</span>
          </div>
          <nav className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              {t('login')}
            </Link>
            <Link href="/register" className="btn-primary text-sm px-5">
              {t('register')}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative max-w-7xl mx-auto px-4 pt-12 pb-14 md:pt-16 md:pb-16 overflow-hidden">
          <div
            className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl opacity-70"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-40 -left-20 h-64 w-64 rounded-full bg-secondary/15 blur-3xl opacity-60"
            aria-hidden
          />
          <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 border border-border/60 backdrop-blur-sm mb-6 text-sm text-text-secondary shadow-soft">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-slow shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                {t('badge')}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.08] tracking-tight mb-5">
                {t('title1')}
                <br />
                <span className="bg-gradient-to-r from-primary via-violet-300 to-secondary bg-clip-text text-transparent">
                  {t('title2')}
                </span>
              </h1>
              <p className="text-lg text-text-secondary max-w-xl mb-8">{t('desc')}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary text-base px-7 py-3">{t('cta')}</Link>
                <a href="#how-it-works" className="btn-secondary text-base px-7 py-3">{t('howItWorks')}</a>
              </div>
            </div>

            <div className="card glass p-6 min-h-[320px] md:h-[360px] relative overflow-hidden border-primary/10">
              <div className="absolute inset-0 shimmer-bg opacity-50" />
              <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-4">{t('liveMapTitle')}</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-surface-hover rounded-xl p-3">
                    <p className="text-xs text-text-muted">{t('metricUsers')}</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  </div>
                  <div className="bg-surface-hover rounded-xl p-3">
                    <p className="text-xs text-text-muted">{t('metricMatches')}</p>
                    <p className="text-2xl font-bold text-match">{stats.totalMatches}</p>
                  </div>
                  {stats.globalCoherence != null && !Number.isNaN(stats.globalCoherence) ? (
                    <div className="bg-surface-hover rounded-xl p-3 col-span-2">
                      <p className="text-xs text-text-muted">{t('metricCoherence')}</p>
                      <p className="text-2xl font-bold text-primary">
                        {Math.round(Number(stats.globalCoherence) * 100)}%
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="h-36 rounded-xl bg-surface-hover border border-border flex flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="text-text-muted text-sm">{t('liveMapPlaceholder')}</p>
                  <Link href="/login" className="btn-secondary text-sm px-5 py-2">
                    {t('liveMapCta')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-6 tracking-tight">{t('socialProof')}</h2>
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
          <h2 className="font-display text-3xl font-bold text-center mb-10 tracking-tight">{t('howItWorks')}</h2>
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
          <div className="card glass p-8 md:p-10 text-center border-primary/15">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 tracking-tight">{t('finalCtaTitle')}</h2>
            <p className="text-text-secondary mb-6">{t('footer')}</p>
            <Link href="/register" className="btn-primary px-8 py-3 text-base">{t('cta')}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 px-4 bg-background/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm text-text-muted">Кассандра © 2026</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Link href="/terms" className="text-text-secondary hover:text-primary transition-colors">
              {t('footerTerms')}
            </Link>
            <Link href="/privacy" className="text-text-secondary hover:text-primary transition-colors">
              {t('footerPrivacy')}
            </Link>
            <span className="text-text-muted">{t('disclaimer')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
