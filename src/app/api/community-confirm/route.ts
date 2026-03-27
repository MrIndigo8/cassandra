import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({
  entry_id: z.string().uuid(),
  matched_patterns: z.array(z.string().min(1)).max(10).optional().default([]),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entry_id');
    if (!entryId) {
      return NextResponse.json({ error: 'entry_id is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { count, error } = await supabase
      .from('community_confirmations')
      .select('*', { count: 'exact', head: true })
      .eq('entry_id', entryId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('community-confirm GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { entry_id, matched_patterns } = parsed.data;

    const { error: insertError } = await supabase.from('community_confirmations').upsert(
      {
        entry_id,
        confirmer_id: user.id,
        matched_patterns,
      },
      { onConflict: 'entry_id,confirmer_id', ignoreDuplicates: false }
    );
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { count, error: countError } = await supabase
      .from('community_confirmations')
      .select('*', { count: 'exact', head: true })
      .eq('entry_id', entry_id);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (error) {
    console.error('community-confirm POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
