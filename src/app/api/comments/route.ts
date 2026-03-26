import { createServerSupabaseClient } from '@/lib/supabase/server';
import { commentSchema, deleteCommentSchema } from '@/lib/validations';
import { updateUserScoring } from '@/lib/scoring';

// GET — получить комментарии к записи
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get('entry_id');
  if (!entryId) return Response.json({ error: 'entry_id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('comments')
    .select('*, users:user_id(username, avatar_url)')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

// POST — добавить комментарий
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { entry_id, content } = parsed.data;

  const { data, error } = await supabase
    .from('comments')
    .insert({ entry_id, user_id: user.id, content: content.trim() })
    .select('*, users:user_id(username, avatar_url)')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  updateUserScoring(user.id, supabase).catch(() => {});
  return Response.json({ data }, { status: 201 });
}

// DELETE — удалить свой комментарий
export async function DELETE(request: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = deleteCommentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { id } = parsed.data;
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
