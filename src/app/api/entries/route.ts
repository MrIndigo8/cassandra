import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkSpam } from '@/lib/antispam';
import { createEntrySchema } from '@/lib/validations';

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

    // Определяем страну пользователя по IP через Vercel заголовки
    const countryCode = req.headers.get('x-vercel-ip-country') || null;

    // Маппинг кода страны в название
    const countryNames: Record<string, string> = {
      'RU': 'Russia', 'US': 'United States', 'GB': 'United Kingdom',
      'DE': 'Germany', 'FR': 'France', 'UA': 'Ukraine', 'BY': 'Belarus',
      'KZ': 'Kazakhstan', 'PL': 'Poland', 'IT': 'Italy', 'ES': 'Spain',
      'TR': 'Turkey', 'CN': 'China', 'JP': 'Japan', 'IN': 'India',
      'BR': 'Brazil', 'CA': 'Canada', 'AU': 'Australia', 'IL': 'Israel',
      'IR': 'Iran', 'SA': 'Saudi Arabia', 'NL': 'Netherlands', 'SE': 'Sweden',
      'NO': 'Norway', 'FI': 'Finland', 'CZ': 'Czech Republic', 'AT': 'Austria',
      'CH': 'Switzerland', 'PT': 'Portugal', 'GR': 'Greece', 'RO': 'Romania',
      'HU': 'Hungary', 'SK': 'Slovakia', 'BG': 'Bulgaria', 'RS': 'Serbia',
      'HR': 'Croatia', 'MX': 'Mexico', 'AR': 'Argentina', 'CL': 'Chile',
      'CO': 'Colombia', 'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria',
      'KR': 'South Korea', 'ID': 'Indonesia', 'PH': 'Philippines', 'TH': 'Thailand',
      'VN': 'Vietnam', 'MY': 'Malaysia', 'SG': 'Singapore', 'PK': 'Pakistan',
      'BD': 'Bangladesh', 'NZ': 'New Zealand'
    };

    const ipGeography = countryCode ? (countryNames[countryCode] || countryCode) : null;

    // 2. Получаем и валидируем данные
    const body = await req.json();
    const parsed = createEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { content, is_public, image_url } = parsed.data;

    // 2.5 Антиспам-проверка
    const spamResult = await checkSpam(user.id, content);
    if (spamResult.isSpam) {
      return NextResponse.json(
        { error: spamResult.reason || 'Слишком много записей. Попробуйте позже.' },
        { status: 429 }
      );
    }

    // 3. Сохранение записи
    const { data: entry, error: insertError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        title: 'Без заголовка',
        content,
        type: 'unknown',
        is_public,
        is_anonymous: false,
        is_quarantine: spamResult.isQuarantine,
        ip_geography: ipGeography,
        ip_country_code: countryCode,
        image_url: image_url || null,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Ошибка сохранения записи' }, { status: 500 });
    }

    // 3.5 Создаем отложенное уведомление через 14 дней
    await supabase.from('notifications').insert({
      user_id: user.id,
      entry_id: entry.id,
      type: 'self_report_reminder',
      title: 'Это предчувствие сбылось?',
      message: content.length > 80 ? content.slice(0, 80) + '...' : content,
      action_type: 'self_report',
      status: 'pending',
      scheduled_for: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    });

    // 4. Инкремент total_entries + streak система
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('total_entries, streak, longest_streak, last_entry_at')
      .eq('id', user.id)
      .single();

    if (!userError && userData) {
      let newStreak = userData.streak || 0;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (userData.last_entry_at) {
        const lastDate = new Date(userData.last_entry_at);
        const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          // Вчера → streak + 1
          newStreak = (userData.streak || 0) + 1;
        } else if (diffDays === 0) {
          // Сегодня уже была запись → streak не меняется
          newStreak = userData.streak || 1;
        } else {
          // Позавчера или раньше → сброс
          newStreak = 1;
        }
      } else {
        // Первая запись
        newStreak = 1;
      }

      const newLongestStreak = Math.max(userData.longest_streak || 0, newStreak);

      await supabase
        .from('users')
        .update({
          total_entries: (userData.total_entries || 0) + 1,
          streak: newStreak,
          longest_streak: newLongestStreak,
          last_entry_at: now.toISOString(),
        })
        .eq('id', user.id);
    }

    return NextResponse.json({ data: entry }, { status: 201 });

  } catch (error) {
    console.error('API /entries error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
