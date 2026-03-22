import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FeedClient } from './FeedClient';
import type { FeedEntry } from '@/components/EntryCard';

// Force dynamic so that the feed is always fresh on load
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const supabase = createServerSupabaseClient();

  // Загружаем начальные 20 записей (только публичные) + джоиним таблицу users для получения автора
  const { data: initialEntries, error } = await supabase
    .from('entries')
    .select(`
      *,
      users:user_id (username, avatar_url)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Ошибка загрузки ленты на сервере:', error);
  }

  return (
    <FeedClient initialEntries={(initialEntries as FeedEntry[]) || []} />
  );
}

