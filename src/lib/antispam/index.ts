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

// In-memory burst rate limiter (per-process, resets on deploy)
const burstMap = new Map<string, number[]>();
const BURST_WINDOW_MS = 60_000; // 1 minute
const BURST_MAX = 5; // max 5 entries per minute

function checkBurstRate(userId: string): boolean {
  const now = Date.now();
  const timestamps = (burstMap.get(userId) || []).filter((t) => now - t < BURST_WINDOW_MS);
  if (timestamps.length >= BURST_MAX) return true; // rate limited
  timestamps.push(now);
  burstMap.set(userId, timestamps);
  return false;
}

/**
 * Антиспам-проверка записи перед сохранением.
 * Проверки: burst → частота → длина → карантин → Claude спам-детектор (async/quarantine).
 */
export async function checkSpam(userId: string, content: string): Promise<SpamResult> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { isSpam: false, isQuarantine: false, spamScore: 0, reason: '' };
  }

  // === Проверка 0: burst rate (in-memory, мгновенная) ===
  if (checkBurstRate(userId)) {
    return {
      isSpam: true,
      isQuarantine: false,
      spamScore: 1.0,
      reason: 'Слишком быстро. Подождите минуту перед следующей записью.',
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const rawCap = Number(process.env.ANTISPAM_MAX_ENTRIES_PER_24H);
  const maxEntriesPer24h =
    Number.isFinite(rawCap) && rawCap > 0 ? Math.min(200, Math.floor(rawCap)) : 20;

  // === Проверка 1: частота (по умолчанию до 20 записей за 24 часа, см. ANTISPAM_MAX_ENTRIES_PER_24H) ===
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { count: recentCount } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', twentyFourHoursAgo.toISOString());

  if ((recentCount || 0) > maxEntriesPer24h) {
    console.log(
      `[AntiSpam] Пользователь ${userId}: превышен лимит записей (${recentCount}/${maxEntriesPer24h} за 24ч)`
    );
    return {
      isSpam: true,
      isQuarantine: false,
      spamScore: 1.0,
      reason: `Слишком много записей за сутки (лимит ${maxEntriesPer24h}). Попробуйте позже.`,
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

  // === Проверка 4: Claude спам-детектор (deferred — quarantine вместо блокировки) ===
  // Запускаем асинхронно, не блокируя создание записи.
  // Если Claude определит спам — запись будет помечена в карантин после сохранения.
  if (anthropic) {
    deferredClaudeCheck(userId, content).catch((err) =>
      console.error('[AntiSpam] Deferred Claude check error:', err)
    );
  }

  return {
    isSpam: false,
    isQuarantine,
    spamScore: 0,
    reason: '',
  };
}

/**
 * Асинхронная проверка через Claude — не блокирует POST.
 * При обнаружении спама помечает последнюю запись пользователя в карантин.
 */
async function deferredClaudeCheck(userId: string, content: string): Promise<void> {
  if (!anthropic) return;

  const response = await anthropic.messages.create({
    model: getModel('utility'),
    max_tokens: 256,
    temperature: 0.1,
    system: SPAM_DETECTION_PROMPT,
    messages: [{ role: 'user', content: `Текст: ${content}` }],
  });

  const responseText = response.content.find((b) => b.type === 'text')?.text;
  if (!responseText) return;

  const cleaned = responseText.replace(/```json\s*|```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned) as {
    spam_score?: number;
    is_suspicious?: boolean;
    flags?: string[];
  };
  const claudeScore = Math.min(1, Math.max(0, Number(parsed.spam_score) || 0));
  const suspicious = parsed.is_suspicious === true;
  const flags = Array.isArray(parsed.flags) ? parsed.flags : [];

  const hardBlock = claudeScore > 0.9;
  const softBlock = suspicious && claudeScore > 0.85;
  const onlySoftFlags =
    flags.length > 0 &&
    flags.every((f) => f === 'too_generic' || f === 'suspicious_pattern') &&
    claudeScore < 0.82;

  if ((hardBlock || softBlock) && !onlySoftFlags) {
    console.log(`[AntiSpam] Claude deferred flag: score=${claudeScore}, flags=${flags}`);
    // Quarantine the user's most recent entry with this content
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase
      .from('entries')
      .update({ is_quarantine: true })
      .eq('user_id', userId)
      .eq('content', content)
      .is('ai_analyzed_at', null);
  }
}
