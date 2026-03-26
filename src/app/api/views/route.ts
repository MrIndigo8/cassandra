import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const entry_id = typeof body?.entry_id === 'string' ? body.entry_id : '';

  if (!entry_id) {
    return Response.json({ error: 'entry_id required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('increment_view_count', {
    p_entry_id: entry_id,
    p_viewer_id: user.id,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ view_count: Number(data || 0) });
}

