import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkSpam } from '@/lib/antispam';
import { createEntrySchema } from '@/lib/validations';
import { updateUserScoring } from '@/lib/scoring';
import { createAdminClient } from '@/lib/supabase/server';
import { analyzeEntry } from '@/lib/claude/client';
import { applyClaudeAnalysisToEntry } from '@/lib/analysis';
import { isFeatureEnabled } from '@/lib/features';
import { DEFAULT_ENTRY_TITLE_RU } from '@/lib/entryDefaults';

export const maxDuration = 60;

const SYNC_ANALYSIS_MS = 20_000;

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
      return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
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
    const { content, is_public, image_url, scope } = parsed.data;

    // 2.5 Антиспам-проверка
    const spamResult = await checkSpam(user.id, content);
    if (spamResult.isSpam) {
      return NextResponse.json(
        { errorCode: 'rateLimited', error: spamResult.reason || undefined },
        { status: 429 }
      );
    }

    // 3. Сохранение записи
    const { data: entry, error: insertError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        title: DEFAULT_ENTRY_TITLE_RU,
        content,
        type: 'unknown',
        is_public,
        is_anonymous: false,
        is_quarantine: spamResult.isQuarantine,
        ip_geography: ipGeography,
        ip_country_code: countryCode,
        image_url: image_url || null,
        scope,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ errorCode: 'saveFailed' }, { status: 500 });
    }

    const contentHash = createHash('sha256')
      .update(`${content}|${entry.created_at}|${user.id}`)
      .digest('hex');
    const { error: hashUpdateErr } = await supabase
      .from('entries')
      .update({ content_hash: contentHash, timestamp_verified: true })
      .eq('id', entry.id);
    if (hashUpdateErr) {
      console.warn('[entries] content_hash update:', hashUpdateErr.message);
    }

    // 3.5 Для personal-сигналов создаем серию self-report напоминаний 3/7/14/30 дней.
    if (scope === 'personal') {
      const offsets = [3, 7, 14, 30];
      const reminderRows = offsets.map((days) => ({
        user_id: user.id,
        entry_id: entry.id,
        type: 'self_report_reminder',
        title: 'Это предчувствие сбылось?',
        message: content.length > 80 ? `${content.slice(0, 80)}...` : content,
        action_type: 'self_report',
        status: 'pending',
        scheduled_for: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      }));
      await supabase.from('notifications').insert(reminderRows);
    }

    // 4. Инкремент total_entries + streak система (новые поля streak_count/last_entry_date)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('total_entries, streak_count, last_entry_date')
      .eq('id', user.id)
      .single();

    if (!userError && userData) {
      const currentStreak = Number(userData.streak_count || 0);
      let newStreak = currentStreak;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (userData.last_entry_date) {
        const lastDate = new Date(userData.last_entry_date);
        const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          newStreak = currentStreak + 1;
        } else if (diffDays === 0) {
          newStreak = currentStreak || 1;
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      await supabase
        .from('users')
        .update({
          total_entries: (userData.total_entries || 0) + 1,
          streak_count: newStreak,
          last_entry_date: today.toISOString().slice(0, 10),
        })
        .eq('id', user.id);
    }

    // Fire-and-forget scoring refresh (activity component).
    updateUserScoring(user.id, supabase).catch(() => {});

    const cronSecret = process.env.CRON_SECRET;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    let syncAnalysisOk = false;
    let analysisPayload: {
      title: string;
      type: string;
      summary: string;
      user_insight: string | null;
      prediction_potential: number | null;
    } | null = null;

    if (await isFeatureEnabled('analysis_enabled')) {
      try {
        const analysis = await Promise.race([
          analyzeEntry(content, 'unknown', null, null, null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), SYNC_ANALYSIS_MS)),
        ]);
        if (analysis) {
          const admin = createAdminClient();
          const entryRow = {
            id: entry.id,
            user_id: user.id,
            content,
            type: 'unknown' as string | null,
            direction: null as string | null,
            timeframe: null as string | null,
            quality: null as string | null,
          };
          const applied = await applyClaudeAnalysisToEntry(admin, entryRow, analysis);
          if (applied) {
            syncAnalysisOk = true;
            analysisPayload = {
              title: analysis.title,
              type: analysis.type,
              summary: analysis.summary,
              user_insight: analysis.user_insight,
              prediction_potential: analysis.prediction_potential,
            };
          }
        }
      } catch (e) {
        console.warn('[entries] sync analysis:', e);
      }
    }

    if (!syncAnalysisOk && cronSecret && appUrl) {
      try {
        const admin = createAdminClient();
        const { data: beforeCron } = await admin
          .from('entries')
          .select('ai_analyzed_at')
          .eq('id', entry.id)
          .maybeSingle();
        if (!beforeCron?.ai_analyzed_at) {
          fetch(`${appUrl}/api/analyze?entryIds=${encodeURIComponent(entry.id)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cronSecret}` },
            cache: 'no-store',
          }).catch((err) => console.warn('[entries] analyze trigger:', err));
        }
      } catch (e) {
        console.warn('[entries] pre-cron check:', e);
        fetch(`${appUrl}/api/analyze?entryIds=${encodeURIComponent(entry.id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cronSecret}` },
          cache: 'no-store',
        }).catch((err) => console.warn('[entries] analyze trigger:', err));
      }
    }

    return NextResponse.json(
      {
        data: entry,
        ...(analysisPayload ? { analysis: analysisPayload } : {}),
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('API /entries error:', error);
    return NextResponse.json({ errorCode: 'internal' }, { status: 500 });
  }
}
