import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const patchBodySchema = z.object({
  full_name: z.string().max(100).optional().nullable(),
  bio: z.string().max(200).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  is_public: z.boolean().optional(),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(req: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') || '';

  let full_name: string | undefined;
  let bio: string | undefined;
  let location: string | undefined;
  let is_public: boolean | undefined;
  let avatarFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const fn = form.get('full_name');
    const b = form.get('bio');
    const loc = form.get('location');
    const pub = form.get('is_public');
    full_name = typeof fn === 'string' ? fn : undefined;
    bio = typeof b === 'string' ? b : undefined;
    location = typeof loc === 'string' ? loc : undefined;
    if (typeof pub === 'string') {
      is_public = pub === 'true' || pub === '1';
    }
    const file = form.get('avatar');
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large' }, { status: 400 });
      }
      avatarFile = file;
    }
    const parsedMulti = patchBodySchema.safeParse({
      full_name: full_name ?? null,
      bio: bio ?? null,
      location: location ?? null,
      is_public,
    });
    if (!parsedMulti.success) {
      return NextResponse.json({ error: parsedMulti.error.flatten() }, { status: 400 });
    }
    full_name = parsedMulti.data.full_name ?? undefined;
    bio = parsedMulti.data.bio ?? undefined;
    location = parsedMulti.data.location ?? undefined;
    is_public = parsedMulti.data.is_public;
  } else {
    const body = await req.json().catch(() => null);
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    full_name = parsed.data.full_name ?? undefined;
    bio = parsed.data.bio ?? undefined;
    location = parsed.data.location ?? undefined;
    is_public = parsed.data.is_public;
  }

  const payload: Record<string, unknown> = {};
  if (full_name !== undefined) {
    payload.full_name = full_name || null;
    payload.display_name = full_name || null;
  }
  if (bio !== undefined) payload.bio = bio || null;
  if (location !== undefined) payload.location = location || null;
  if (is_public !== undefined) payload.is_public = is_public;

  if (avatarFile) {
    const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = `${user.id}/${Date.now()}.${safeExt}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
      upsert: true,
      contentType: avatarFile.type || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
    });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path);
    payload.avatar_url = publicUrl;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase.from('users').update(payload).eq('id', user.id).select('*').single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
