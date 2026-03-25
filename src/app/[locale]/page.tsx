// ============================================================
// Кассандра — Лендинг
// Главная страница платформы (до авторизации)
// ============================================================
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { LanguageRedirect } from '@/components/LanguageRedirect';

export default async function HomePage() {
  const t = await getTranslations('landing');
  return (
    <div className="min-h-screen flex flex-col">
      <LanguageRedirect />
      {/* Навигация */}
      <header className="border-b border-void-border/50 backdrop-blur-sm bg-void/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-aurora flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-sm">К</span>
            </div>
            <span className="text-xl font-bold text-mist">Кассандра</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-mist-dim hover:text-mist transition-colors">
              {t('login')}
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              {t('register')}
            </Link>
          </nav>
        </div>
      </header>

      {/* Герой */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Бейдж */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cassandra-900/50 border border-cassandra-700/30 mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" aria-hidden="true" />
            <span className="text-sm text-cassandra-300">
              {t('badge')}
            </span>
          </div>

          {/* Заголовок */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-mist">{t('title1')}</span>
            <br />
            <span className="text-gradient">{t('title2')}</span>
          </h1>

          {/* Подзаголовок */}
          <p className="text-lg sm:text-xl text-mist-dim max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('desc')}
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/register" className="btn-primary text-lg px-8 py-3">
              {t('cta')}
            </Link>
            <a href="#how-it-works" className="btn-secondary text-lg px-8 py-3">
              {t('howItWorks')}
            </a>
          </div>

          {/* Дисклеймер */}
          <p className="text-xs text-mist-faint max-w-md mx-auto">
            {t('disclaimer')}
          </p>
        </div>

        {/* Декоративные элементы */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cassandra-700/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </main>

      {/* Как это работает */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-mist">
            {t('howItWorks')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Шаг 1 */}
            <div className="card text-center group">
              <div className="w-14 h-14 rounded-xl bg-dream/10 border border-dream/20 flex items-center justify-center mx-auto mb-4 group-hover:shadow-glow-sm transition-shadow" aria-hidden="true">
                <span className="text-2xl">🌙</span>
              </div>
              <h3 className="text-lg font-semibold text-mist mb-2">{t('step1.title')}</h3>
              <p className="text-mist-dim text-sm">
                {t('step1.desc')}
              </p>
            </div>

            {/* Шаг 2 */}
            <div className="card text-center group">
              <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 group-hover:shadow-glow-sm transition-shadow" aria-hidden="true">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="text-lg font-semibold text-mist mb-2">{t('step2.title')}</h3>
              <p className="text-mist-dim text-sm">
                {t('step2.desc')}
              </p>
            </div>

            {/* Шаг 3 */}
            <div className="card text-center group">
              <div className="w-14 h-14 rounded-xl bg-match/10 border border-match/20 flex items-center justify-center mx-auto mb-4 group-hover:shadow-glow-sm transition-shadow" aria-hidden="true">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="text-lg font-semibold text-mist mb-2">{t('step3.title')}</h3>
              <p className="text-mist-dim text-sm">
                {t('step3.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Футер */}
      <footer className="border-t border-void-border/50 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-aurora flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-xs">К</span>
            </div>
            <span className="text-sm text-mist-dim">Кассандра © 2026</span>
          </div>
          <p className="text-xs text-mist-faint">
            {t('footer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
