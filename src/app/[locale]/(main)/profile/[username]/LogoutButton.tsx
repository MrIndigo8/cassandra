'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations('profile');

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors mt-3 block"
    >
      {t('logout')}
    </button>
  );
}
