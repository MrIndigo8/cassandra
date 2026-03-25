import { createServerSupabaseClient } from '@/lib/supabase/server';
import { reactionSchema } from '@/lib/validations';

// GET — получить реакции к записи
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get('entry_id');
  if (!entryId) return Response.json({ error: 'entry_id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('reactions')
    .select('emoji, user_id')
    .eq('entry_id', entryId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Группируем по эмодзи
  const grouped: Record<string, { count: number; hasMyReaction: boolean }> = {};
  const emojis = ['🔮','😨','✨','🌊','🔥','⚡','👁'];
  
  emojis.forEach(emoji => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactions = data?.filter((r: any) => r.emoji === emoji) || [];
    grouped[emoji] = {
      count: reactions.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hasMyReaction: user ? reactions.some((r: any) => r.user_id === user.id) : false
    };
  });

  return Response.json({ data: grouped });
}

// POST — добавить или убрать реакцию (toggle)
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { entry_id, emoji } = parsed.data;

  // Проверяем есть ли уже такая реакция
  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('entry_id', entry_id)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .single();

  if (existing) {
    // Убираем реакцию
    await supabase.from('reactions').delete().eq('id', existing.id);
    return Response.json({ action: 'removed' });
  } else {
    // Добавляем реакцию
    await supabase.from('reactions').insert({
      entry_id, user_id: user.id, emoji
    });
    return Response.json({ action: 'added' });
  }
}
