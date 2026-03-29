import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PsycheDashboard from './PsycheDashboard';

export const dynamic = 'force-dynamic';

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
