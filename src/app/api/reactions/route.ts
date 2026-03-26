import { createServerSupabaseClient } from '@/lib/supabase/server';
import { reactionSchema } from '@/lib/validations';

// GET — получить реакции к записи
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get('entry_id');
  const type = searchParams.get('type');
  if (!entryId) return Response.json({ error: 'entry_id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('reactions')
    .select('emoji, user_id')
    .eq('entry_id', entryId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (type === 'like') {
    const likes = data?.filter((r) => r.emoji === 'like') || [];
    const userLiked = user ? likes.some((r) => r.user_id === user.id) : false;
    return Response.json({
      likes_count: likes.length,
      user_liked: userLiked,
    });
  }

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
    const { error: deleteError } = await supabase.from('reactions').delete().eq('id', existing.id);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
    return Response.json({ action: 'removed' });
  } else {
    // Добавляем реакцию
    const { error: insertError } = await supabase.from('reactions').insert({
      entry_id, user_id: user.id, emoji
    });
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 });
    return Response.json({ action: 'added' });
  }
}
