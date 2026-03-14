'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !user) {
        // Не авторизован, но должен быть -> редирект на логин
        router.push(`/login?next=${pathname}`);
      } else if (!requireAuth && user) {
        // Авторизован, но на публичной странице (напр. логин) -> редирект в ленту
        // В нашем случае login/register не используют AuthGuard, это скорее для /
        router.push('/feed');
      }
    }
  }, [user, isLoading, requireAuth, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cassandra-800 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Если требует авторизацию и юзера нет, возвращаем null (в процессе редиректа)
  if (requireAuth && !user) {
    return null;
  }

  return <>{children}</>;
}
