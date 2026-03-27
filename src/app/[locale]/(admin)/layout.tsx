import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('role, username').eq('id', user.id).single();
  if (!profile || !['architect', 'admin', 'moderator'].includes(profile.role)) {
    redirect('/feed');
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <AdminSidebar role={profile.role} username={profile.username || 'admin'} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
