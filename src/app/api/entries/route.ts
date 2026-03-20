import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in server component context
            }
          },
        },
      }
    );

    // 1. Проверяем авторизацию
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    // 2. Получаем данные
    const body = await req.json();
    const { content, is_public = true } = body;

    // Валидация
    if (!content || content.length < 30) {
      return NextResponse.json({ error: 'Текст сигнала слишком короткий (минимум 30 символов)' }, { status: 400 });
    }

    // 3. Сохранение записи
    const { data: entry, error: insertError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        title: 'Без заголовка', // В будущем ИИ может генерировать заголовок, пока ставим заглушку
        content,
        type: 'unknown',
        is_public,
        is_anonymous: false,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Ошибка сохранения записи' }, { status: 500 });
    }

    // 4. Инкремент total_entries пользователя
    // Поскольку у нас нет RPC, делаем select + update (можно заменить на RPC в будущем)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('total_entries')
      .eq('id', user.id)
      .single();

    if (!userError && userData) {
      await supabase
        .from('users')
        .update({ total_entries: userData.total_entries + 1 })
        .eq('id', user.id);
    }

    return NextResponse.json({ data: entry }, { status: 201 });

  } catch (error) {
    console.error('API /entries error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
