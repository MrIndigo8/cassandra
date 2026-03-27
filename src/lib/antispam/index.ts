import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { SPAM_DETECTION_PROMPT } from '../claude/prompts';
import { getModel } from '../claude/models';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export interface SpamResult {
  isSpam: boolean;
  isQuarantine: boolean;
  spamScore: number;
  reason: string;
}

/**
 * Антиспам-проверка записи перед сохранением.
 * Проверки: частота → длина → карантин → Claude спам-детектор.
 */
export async function checkSpam(userId: string, content: string): Promise<SpamResult> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { isSpam: false, isQuarantine: false, spamScore: 0, reason: '' };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // === Проверка 1: частота (> 5 записей за 24 часа) ===
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { count: recentCount } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', twentyFourHoursAgo.toISOString());

  if ((recentCount || 0) > 5) {
    console.log(`[AntiSpam] Пользователь ${userId}: превышен лимит записей (${recentCount}/24ч)`);
    return {
      isSpam: true,
      isQuarantine: false,
      spamScore: 1.0,
      reason: 'Слишком много записей. Попробуйте позже.',
    };
  }

  // === Проверка 2: длина (< 30 символов) ===
  if (content.trim().length < 30) {
    console.log(`[AntiSpam] Пользователь ${userId}: слишком короткая запись (${content.length} символов)`);
    return {
      isSpam: true,
      isQuarantine: false,
      spamScore: 0.8,
      reason: 'Текст сигнала слишком короткий (минимум 30 символов)',
    };
  }

  // === Проверка 3: карантин (регистрация < 30 дней) ===
  let isQuarantine = false;
  const { data: userProfile } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (userProfile) {
    const daysSinceRegistration =
      (Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 3600 * 24);
    if (daysSinceRegistration < 30) {
      isQuarantine = true;
      console.log(`[AntiSpam] Пользователь ${userId}: карантин (${Math.floor(daysSinceRegistration)} дней)`);
    }
  }

  // === Проверка 4: Claude спам-детектор ===
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: getModel('utility'),
        max_tokens: 256,
        temperature: 0.1,
        system: SPAM_DETECTION_PROMPT,
        messages: [{ role: 'user', content: `Текст: ${content}` }],
      });

      const responseText = response.content.find(b => b.type === 'text')?.text;
      if (responseText) {
        const cleaned = responseText.replace(/```json\s*|```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const claudeScore = parsed.spam_score || 0;

        if (claudeScore > 0.7 || parsed.is_suspicious === true) {
          console.log(`[AntiSpam] Claude флаг: score=${claudeScore}, flags=${parsed.flags}`);
          return {
            isSpam: true,
            isQuarantine,
            spamScore: claudeScore,
            reason: `Запись отклонена системой качества: ${(parsed.flags || []).join(', ') || 'подозрительный паттерн'}`,
          };
        }
      }
    } catch (err) {
      console.error('[AntiSpam] Ошибка Claude спам-детектора:', err);
      // Не блокируем запись при ошибке Claude
    }
  }

  return {
    isSpam: false,
    isQuarantine,
    spamScore: 0,
    reason: '',
  };
}
