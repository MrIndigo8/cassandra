'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/feed';
  const t = useTranslations('auth');
  
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError(t('errors.invalidCredentials'));
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${next}`,
      },
    });

    if (error) {
      setError('Ошибка входа через Google: ' + error.message);
    }
  };

  return (
    <>
      <button
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 hover:bg-gray-100 px-6 py-2.5 rounded-lg font-medium transition-all mb-6 active:scale-[0.98]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {t('googleLogin')}
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-px bg-void-border flex-1"></div>
        <span className="text-xs text-mist-faint uppercase font-medium">или по email</span>
        <div className="h-px bg-void-border flex-1"></div>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm p-3 rounded-lg text-center">
            {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="имя@example.com"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">{t('password')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex justify-center mt-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
            t('login')
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-mist-dim">
        {t('noAccount')}{' '}
        <Link href={`/register${next !== '/feed' ? `?next=${next}` : ''}`} className="text-accent hover:text-accent-light transition-colors font-medium">
          {t('register')}
        </Link>
      </div>
    </>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  
  return (
    <div className="card w-full max-w-md mx-auto relative z-10 glass">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-aurora mb-4 shadow-glow-sm">
          <span className="text-white font-bold text-xl">{tCommon('appName')[0]}</span>
        </div>
        <h1 className="text-2xl font-bold text-gradient mb-2">{t('loginTitle')}</h1>
        <p className="text-sm text-mist-dim">
          {tCommon('tagline')}
        </p>
      </div>
      <Suspense fallback={<div className="text-center py-4">...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
