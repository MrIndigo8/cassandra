'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'auto' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

function resolveAutoTheme(): ResolvedTheme {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 8 ? 'dark' : 'light';
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  html.classList.add(theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as ThemeMode | null;
    const initialMode: ThemeMode = saved === 'dark' || saved === 'light' || saved === 'auto' ? saved : 'auto';
    const initialResolved = initialMode === 'auto' ? resolveAutoTheme() : initialMode;
    setThemeState(initialMode);
    setResolvedTheme(initialResolved);
    applyTheme(initialResolved);
  }, []);

  useEffect(() => {
    if (theme !== 'auto') return;
    const timer = setInterval(() => {
      const next = resolveAutoTheme();
      setResolvedTheme((prev) => {
        if (prev !== next) applyTheme(next);
        return next;
      });
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
    const resolved = next === 'auto' ? resolveAutoTheme() : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );
}
