import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifLocale } from '@/lib/engagement/generator-i18n';
import {
  deepInsightStrings,
  pick,
  report14Strings,
  selfReportStrings,
  similarStrings,
  trackingStrings,
  weeklyStrings,
} from '@/lib/engagement/generator-i18n';

function snippet(title: string | null, content: string | null, len = 50): string {
  return title || (content || '').slice(0, len);
}

export async function generateDeepInsight(
  entry: {
    id: string;
    title: string | null;
    content: string | null;
    prediction_potential?: number | null;
  },
  supabase: SupabaseClient,
  locale: NotifLocale = 'ru'
): Promise<string> {
  const { data: deep } = await supabase
    .from('deep_analysis')
    .select('archetypes, narrative_structure')
    .eq('entry_id', entry.id)
    .maybeSingle();

  if (!deep) {
    const s = snippet(entry.title, entry.content);
    return locale === 'en' ? deepInsightStrings.noDeep.en(s) : deepInsightStrings.noDeep.ru(s);
  }

  const parts: string[] = [];

  const mainArch = Array.isArray(deep.archetypes) ? deep.archetypes[0] : null;
  if (mainArch && typeof mainArch === 'string') {
    const arch =
      deepInsightStrings.arch[mainArch as keyof typeof deepInsightStrings.arch];
    if (arch) {
      parts.push(pick(locale, arch));
    } else {
      parts.push(
        locale === 'en'
          ? deepInsightStrings.archFallback.en(mainArch)
          : deepInsightStrings.archFallback.ru(mainArch)
      );
    }
  }

  if (typeof deep.narrative_structure === 'string' && deep.narrative_structure.trim()) {
    const prefix = pick(locale, deepInsightStrings.narrativePrefix);
    parts.push(`${prefix} ${deep.narrative_structure.trim()}.`);
  }

  if ((entry.prediction_potential || 0) > 0.6) {
    parts.push(pick(locale, deepInsightStrings.highPotential));
  }

  return (
    parts.join('\n\n') || pick(locale, deepInsightStrings.fallback)
  );
}

export async function findSimilarEntries(
  entry: {
    anxiety_score?: number | null;
    threat_type?: string | null;
  },
  userId: string,
  supabase: SupabaseClient,
  locale: NotifLocale = 'ru'
): Promise<{ count: number; message: string }> {
  const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: similar } = await supabase
    .from('entries')
    .select('id, anxiety_score, threat_type, ip_country_code')
    .neq('user_id', userId)
    .eq('is_public', true)
    .gte('created_at', sevenDays)
    .not('anxiety_score', 'is', null)
    .limit(500);

  const entryAnxiety = entry.anxiety_score || 0;
  const entryThreat = entry.threat_type || null;
  const matches = (similar || []).filter((s) => {
    const anxietyClose = Math.abs((s.anxiety_score || 0) - entryAnxiety) <= 2;
    const threatMatch = entryThreat && s.threat_type === entryThreat;
    return Boolean(anxietyClose || threatMatch);
  });

  if (matches.length === 0) return { count: 0, message: '' };

  const countries = new Set(matches.map((m) => m.ip_country_code).filter(Boolean));
  const u = locale === 'en' ? similarStrings.users.en : similarStrings.users.ru;
  let message = `${matches.length} ${u}`;
  if (countries.size > 1) {
    message += ` ${locale === 'en' ? similarStrings.fromCountries.en : similarStrings.fromCountries.ru} ${countries.size} ${
      locale === 'en' ? similarStrings.countries.en : similarStrings.countries.ru
    }`;
  }
  message += ` ${locale === 'en' ? similarStrings.weekLine.en : similarStrings.weekLine.ru}`;
  if (entryThreat && entryThreat !== 'unknown' && entryThreat !== 'personal') {
    message += ` ${locale === 'en' ? similarStrings.theme.en : similarStrings.theme.ru} ${entryThreat}.`;
  }
  message += locale === 'en' ? similarStrings.openMap.en : similarStrings.openMap.ru;
  return { count: matches.length, message };
}

export async function getTrackingStatus(
  entry: {
    id: string;
    title: string | null;
    content: string | null;
    prediction_potential?: number | null;
    sensory_data?: { verification_keywords?: string[] } | null;
  },
  supabase: SupabaseClient,
  locale: NotifLocale = 'ru'
): Promise<string> {
  const { data: match } = await supabase
    .from('matches')
    .select('similarity_score, event_title')
    .eq('entry_id', entry.id)
    .gt('similarity_score', 0.5)
    .order('similarity_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (match) {
    const pct = Math.round((match.similarity_score || 0) * 100);
    return locale === 'en'
      ? trackingStrings.match.en(match.event_title || '', pct)
      : trackingStrings.match.ru(match.event_title || '', pct);
  }

  const indicators = entry.sensory_data?.verification_keywords?.length || 0;
  const title = snippet(entry.title, entry.content, 40);
  const observing = locale === 'en' ? trackingStrings.observing.en(title) : trackingStrings.observing.ru(title);
  const parts = [
    observing,
    '',
    locale === 'en' ? trackingStrings.whatWeDo.en : trackingStrings.whatWeDo.ru,
    locale === 'en' ? trackingStrings.bulletScan.en : trackingStrings.bulletScan.ru,
    locale === 'en' ? trackingStrings.bulletIndicators.en(indicators) : trackingStrings.bulletIndicators.ru(indicators),
  ];
  if ((entry.prediction_potential || 0) > 0.7) {
    parts.push(locale === 'en' ? trackingStrings.bulletHigh.en : trackingStrings.bulletHigh.ru);
  }
  parts.push(
    '',
    locale === 'en' ? trackingStrings.notifyLine.en : trackingStrings.notifyLine.ru
  );
  return parts.join('\n');
}

export async function get14DayReport(
  entry: { id: string; title: string | null; content: string | null; created_at: string },
  supabase: SupabaseClient,
  locale: NotifLocale = 'ru'
): Promise<string> {
  const { data: matches } = await supabase
    .from('matches')
    .select('similarity_score, event_title')
    .eq('entry_id', entry.id)
    .gt('similarity_score', 0.5);

  const dateStr = new Date(entry.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU');
  const snip = snippet(entry.title, entry.content);
  let head =
    locale === 'en'
      ? report14Strings.head.en(dateStr, snip)
      : report14Strings.head.ru(dateStr, snip);

  if (matches && matches.length > 0) {
    const best = [...matches].sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))[0];
    const pct = Math.round((best.similarity_score || 0) * 100);
    head +=
      locale === 'en'
        ? report14Strings.match.en(best.event_title || '', pct)
        : report14Strings.match.ru(best.event_title || '', pct);
  } else {
    head += locale === 'en' ? report14Strings.noMatch.en : report14Strings.noMatch.ru;
  }
  return head;
}

export function selfReport7dMessage(
  entry: { title: string | null; content: string | null },
  locale: NotifLocale
): string {
  const s = snippet(entry.title, entry.content, 50);
  return locale === 'en' ? selfReportStrings.d7.en(s) : selfReportStrings.d7.ru(s);
}

export function selfReport14dMessage(
  entry: { title: string | null; content: string | null },
  locale: NotifLocale
): string {
  const s = snippet(entry.title, entry.content, 50);
  return locale === 'en' ? selfReportStrings.d14.en(s) : selfReportStrings.d14.ru(s);
}

export async function generateWeeklyDigest(
  userId: string,
  supabase: SupabaseClient,
  locale: NotifLocale = 'ru'
): Promise<{ title: string; message: string } | null> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: entries } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', weekAgo);
  if (!entries || entries.length === 0) return null;

  const entryIds = entries.map((e) => e.id);
  const [{ data: myMatches }, { data: user }, { data: fp }, { count: platformMatches }] = await Promise.all([
    supabase
      .from('matches')
      .select('similarity_score, event_title')
      .eq('user_id', userId)
      .gt('similarity_score', 0.6)
      .gte('created_at', weekAgo),
    supabase.from('users').select('streak_count, rating_score').eq('id', userId).maybeSingle(),
    supabase.from('symbolic_fingerprints').select('total_dreams_analyzed').eq('user_id', userId).maybeSingle(),
    supabase.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ]);

  const parts: string[] = [
    locale === 'en' ? weeklyStrings.header.en : weeklyStrings.header.ru,
    '',
    locale === 'en' ? weeklyStrings.entries.en(entryIds.length) : weeklyStrings.entries.ru(entryIds.length),
  ];
  if ((user?.streak_count || 0) > 0) {
    const sc = user?.streak_count ?? 0;
    parts.push(locale === 'en' ? weeklyStrings.streak.en(sc) : weeklyStrings.streak.ru(sc));
  }
  if ((user?.rating_score || 0) > 0) {
    const rs = (user?.rating_score || 0).toFixed(1);
    parts.push(locale === 'en' ? weeklyStrings.rating.en(rs) : weeklyStrings.rating.ru(rs));
  }
  parts.push('');

  if (myMatches && myMatches.length > 0) {
    parts.push(locale === 'en' ? weeklyStrings.yourMatches.en : weeklyStrings.yourMatches.ru);
    myMatches.slice(0, 3).forEach((m) => {
      const pct = Math.round((m.similarity_score || 0) * 100);
      parts.push(
        locale === 'en'
          ? weeklyStrings.matchLine.en(m.event_title || '', pct)
          : weeklyStrings.matchLine.ru(m.event_title || '', pct)
      );
    });
    parts.push('');
  }

  parts.push(
    locale === 'en'
      ? weeklyStrings.platform.en(platformMatches || 0)
      : weeklyStrings.platform.ru(platformMatches || 0)
  );

  const analyzed = fp?.total_dreams_analyzed || 0;
  if (analyzed < 10) {
    parts.push('', locale === 'en' ? weeklyStrings.profileProgress.en(analyzed) : weeklyStrings.profileProgress.ru(analyzed));
  } else if (analyzed < 20) {
    parts.push('', locale === 'en' ? weeklyStrings.oracleProgress.en(analyzed) : weeklyStrings.oracleProgress.ru(analyzed));
  }
  parts.push('', locale === 'en' ? weeklyStrings.cta.en : weeklyStrings.cta.ru);

  const mc = myMatches?.length || 0;
  const title =
    locale === 'en'
      ? weeklyStrings.title.en(entryIds.length, mc)
      : weeklyStrings.title.ru(entryIds.length, mc);

  return {
    title,
    message: parts.join('\n'),
  };
}
