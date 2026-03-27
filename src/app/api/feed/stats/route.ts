import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1).max(200),
});

type CountMap = Record<string, number>;

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { entry_ids } = parsed.data;
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [likesRes, commentsRes, communityRes, likedRes] = await Promise.all([
      supabase
        .from('reactions')
        .select('entry_id')
        .eq('emoji', 'like')
        .in('entry_id', entry_ids),
      supabase
        .from('comments')
        .select('entry_id')
        .in('entry_id', entry_ids),
      supabase
        .from('community_confirmations')
        .select('entry_id')
        .in('entry_id', entry_ids),
      user
        ? supabase
            .from('reactions')
            .select('entry_id')
            .eq('user_id', user.id)
            .eq('emoji', 'like')
            .in('entry_id', entry_ids)
        : Promise.resolve({ data: [] as Array<{ entry_id: string }>, error: null }),
    ]);

    if (likesRes.error || commentsRes.error || communityRes.error || likedRes.error) {
      const message =
        likesRes.error?.message ||
        commentsRes.error?.message ||
        communityRes.error?.message ||
        likedRes.error?.message ||
        'Failed to load feed stats';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const likesCount: CountMap = {};
    const commentsCount: CountMap = {};
    const communityCount: CountMap = {};
    const userLiked: Record<string, boolean> = {};

    likesRes.data?.forEach((row: { entry_id: string }) => {
      likesCount[row.entry_id] = (likesCount[row.entry_id] || 0) + 1;
    });
    commentsRes.data?.forEach((row: { entry_id: string }) => {
      commentsCount[row.entry_id] = (commentsCount[row.entry_id] || 0) + 1;
    });
    communityRes.data?.forEach((row: { entry_id: string }) => {
      communityCount[row.entry_id] = (communityCount[row.entry_id] || 0) + 1;
    });
    likedRes.data?.forEach((row: { entry_id: string }) => {
      userLiked[row.entry_id] = true;
    });

    return NextResponse.json({
      likesCount,
      commentsCount,
      communityCount,
      userLiked,
    });
  } catch (error) {
    console.error('[feed/stats] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

