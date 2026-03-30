import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

export const revalidate = 0;

const PsycheDashboard = dynamic(() => import('./PsycheDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-text-secondary">Загрузка дашборда...</div>
    </div>
  ),
  ssr: false,
});

export default async function AdminPsychePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!profile?.role || !['architect', 'admin'].includes(profile.role)) {
    redirect('/admin');
  }

  return <PsycheDashboard />;
}
