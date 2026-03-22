'use client';

import { useEffect } from 'react';
import { useRouter } from '@/navigation';
import { useLocale } from 'next-intl';

export function LanguageRedirect() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    // Only run on the initial visit if no locale is saved
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale) return;

    const browserLang = navigator.language.split('-')[0];
    // If the browser language is "en" and we are not currently in "en", redirect
    if (browserLang === 'en' && locale !== 'en') {
      router.replace('/', { locale: 'en' });
    }
    // If browser language is "ru" (or anything else), we stay on default '/' as requested
  }, [locale, router]);

  return null;
}
