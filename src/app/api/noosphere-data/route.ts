import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type AnxietyEntry = {
  id: string;
  anxiety_score: number | null;
  emotional_intensity: string | null;
  ip_country_code: string | null;
  sensory_data: {
    verification_keywords?: string[];
  } | null;
  created_at: string;
};

type SubjectEntry = {
  geography_iso: string | null;
  threat_type: string | null;
  anxiety_score: number | null;
  temporal_urgency: string | null;
  created_at: string;
};

type MatchJoinedEntry = {
  id: string;
  geography_iso: string | null;
  anxiety_score: number | null;
  threat_type: string | null;
  ai_summary: string | null;
  content: string | null;
  sensory_data: {
    verification_keywords?: string[];
  } | null;
  ip_country_code: string | null;
  created_at: string;
  users:
    | {
        username: string | null;
        avatar_url: string | null;
      }
    | Array<{
        username: string | null;
        avatar_url: string | null;
      }>
    | null;
};

type MatchRow = {
  id: string;
  similarity_score: number | null;
  event_title: string | null;
  event_description: string | null;
  event_url: string | null;
  event_date: string | null;
  matched_symbols: string[] | null;
  created_at: string;
  entries: MatchJoinedEntry | MatchJoinedEntry[] | null;
};

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let anxietyRaw: AnxietyEntry[] | null = null;
    let anxietyError: { message: string } | null = null;
    {
      const res = await supabase
        .from('entries')
        .select('id, anxiety_score, ip_country_code, emotional_intensity, sensory_data, created_at')
        .not('ip_country_code', 'is', null)
        .not('anxiety_score', 'is', null)
        .gte('created_at', sevenDaysAgo)
        .gte('anxiety_score', 3)
        .eq('is_public', true);
      if (res.error?.message?.includes('sensory_data does not exist')) {
        const fallback = await supabase
          .from('entries')
          .select('id, anxiety_score, ip_country_code, emotional_intensity, created_at')
          .not('ip_country_code', 'is', null)
          .not('anxiety_score', 'is', null)
          .gte('created_at', sevenDaysAgo)
          .gte('anxiety_score', 3)
          .eq('is_public', true);
        anxietyRaw = ((fallback.data || []) as AnxietyEntry[]).map((row) => ({ ...row, sensory_data: null }));
        anxietyError = fallback.error ? { message: fallback.error.message } : null;
      } else {
        anxietyRaw = (res.data || []) as AnxietyEntry[];
        anxietyError = res.error ? { message: res.error.message } : null;
      }
    }

    if (anxietyError) {
      return NextResponse.json({ error: anxietyError.message }, { status: 500 });
    }

    const anxietyEntries = (anxietyRaw || []) as AnxietyEntry[];
    const anxietyByUserCountry: Record<
      string,
      {
        iso: string;
        totalAnxiety: number;
        entryCount: number;
        avgAnxiety: number;
        maxAnxiety: number;
        panicCount: number;
      }
    > = {};
    for (const entry of anxietyEntries) {
      const iso = (entry.ip_country_code || '').toUpperCase();
      if (!iso) continue;
      if (!anxietyByUserCountry[iso]) {
        anxietyByUserCountry[iso] = {
          iso,
          totalAnxiety: 0,
          entryCount: 0,
          avgAnxiety: 0,
          maxAnxiety: 0,
          panicCount: 0,
        };
      }
      const c = anxietyByUserCountry[iso];
      const anxiety = entry.anxiety_score || 0;
      c.totalAnxiety += anxiety;
      c.entryCount += 1;
      c.maxAnxiety = Math.max(c.maxAnxiety, anxiety);
      if (entry.emotional_intensity === 'panic') c.panicCount += 1;
    }

    const anxietyHeatmap = Object.values(anxietyByUserCountry).map((country) => ({
      ...country,
      avgAnxiety: Math.round((country.totalAnxiety / country.entryCount) * 10) / 10,
    }));

    let confirmedRaw: MatchRow[] | null = null;
    let confirmedError: { message: string } | null = null;
    {
      const res = await supabase
        .from('matches')
        .select(`
        id, similarity_score, event_title, event_description, event_url, event_date, matched_symbols, created_at,
        entries:entry_id (
          id, geography_iso, anxiety_score, threat_type, ai_summary, content, sensory_data, ip_country_code, created_at,
          users:user_id (username, avatar_url)
        )
      `)
        .gt('similarity_score', 0.6)
        .order('created_at', { ascending: false })
        .limit(20);

      if (res.error?.message?.includes('sensory_data does not exist')) {
        const fallback = await supabase
          .from('matches')
          .select(`
            id, similarity_score, event_title, event_description, event_url, event_date, matched_symbols, created_at,
            entries:entry_id (
              id, geography_iso, anxiety_score, threat_type, ai_summary, content, ip_country_code, created_at,
              users:user_id (username, avatar_url)
            )
          `)
          .gt('similarity_score', 0.6)
          .order('created_at', { ascending: false })
          .limit(20);
        confirmedRaw = (fallback.data || []) as MatchRow[];
        confirmedError = fallback.error ? { message: fallback.error.message } : null;
      } else {
        confirmedRaw = (res.data || []) as MatchRow[];
        confirmedError = res.error ? { message: res.error.message } : null;
      }
    }

    if (confirmedError) {
      return NextResponse.json({ error: confirmedError.message }, { status: 500 });
    }

    const confirmedMatches = (confirmedRaw || []) as MatchRow[];
    type MatchPoint = {
      iso: string;
      matchCount: number;
      avgScore: number;
      topMatch: {
        id: string;
        score: number;
        eventTitle: string;
        eventDate: string;
        eventUrl: string | null;
        entrySummary: string;
        entryContent: string;
        threatType: string;
        matchedSymbols: string[];
        authorUsername: string;
        authorCountry: string | null;
        daysBefore: number;
      };
      allMatches: Array<{ score: number; eventTitle: string; threatType: string }>;
    };
    const matchByGeo: Record<string, MatchPoint> = {};

    for (const match of confirmedMatches) {
      const entry = Array.isArray(match.entries) ? match.entries[0] : match.entries;
      if (!entry?.geography_iso) continue;
      const iso = entry.geography_iso.toUpperCase();
      const score = match.similarity_score || 0;
      const threatType = entry.threat_type || 'unknown';
      const eventDateRaw = match.event_date || match.created_at;
      const daysBefore = Math.round(
        (new Date(eventDateRaw).getTime() - new Date(entry.created_at || match.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const user = Array.isArray(entry.users) ? entry.users[0] : entry.users;

      if (!matchByGeo[iso]) {
        matchByGeo[iso] = {
          iso,
          matchCount: 0,
          avgScore: 0,
          topMatch: {
            id: match.id,
            score,
            eventTitle: match.event_title || '',
            eventDate: eventDateRaw,
            eventUrl: match.event_url || null,
            entrySummary: entry.ai_summary || entry.content?.slice(0, 100) || '',
            entryContent: entry.content?.slice(0, 200) || '',
            threatType,
            matchedSymbols: match.matched_symbols || [],
            authorUsername: user?.username || 'anonymous',
            authorCountry: entry.ip_country_code || null,
            daysBefore: Math.max(0, daysBefore),
          },
          allMatches: [],
        };
      }
      const g = matchByGeo[iso];
      g.matchCount += 1;
      g.allMatches.push({ score, eventTitle: match.event_title || '', threatType });
      if (score > g.topMatch.score) {
        g.topMatch = {
          id: match.id,
          score,
          eventTitle: match.event_title || '',
          eventDate: eventDateRaw,
          eventUrl: match.event_url || null,
          entrySummary: entry.ai_summary || entry.content?.slice(0, 100) || '',
          entryContent: entry.content?.slice(0, 200) || '',
          threatType,
          matchedSymbols: match.matched_symbols || [],
          authorUsername: user?.username || 'anonymous',
          authorCountry: entry.ip_country_code || null,
          daysBefore: Math.max(0, daysBefore),
        };
      }
    }

    const matchPoints = Object.values(matchByGeo).map((g) => ({
      ...g,
      avgScore: Math.round((g.allMatches.reduce((sum, item) => sum + item.score, 0) / g.matchCount) * 100) / 100,
    }));

    const { data: subjectRaw, error: subjectError } = await supabase
      .from('entries')
      .select('geography_iso, threat_type, anxiety_score, temporal_urgency, created_at')
      .not('geography_iso', 'is', null)
      .not('anxiety_score', 'is', null)
      .gte('created_at', sevenDaysAgo)
      .eq('is_public', true);

    if (subjectError) {
      return NextResponse.json({ error: subjectError.message }, { status: 500 });
    }
    const subjectEntries = (subjectRaw || []) as SubjectEntry[];
    const subjectByGeo: Record<
      string,
      {
        iso: string;
        entryCount: number;
        avgAnxiety: number;
        dominantThreat: string;
        hasImminentSignals: boolean;
      }
    > = {};
    for (const entry of subjectEntries) {
      const iso = (entry.geography_iso || '').toUpperCase();
      if (!iso) continue;
      if (!subjectByGeo[iso]) {
        subjectByGeo[iso] = {
          iso,
          entryCount: 0,
          avgAnxiety: 0,
          dominantThreat: 'unknown',
          hasImminentSignals: false,
        };
      }
      const s = subjectByGeo[iso];
      s.entryCount += 1;
      s.avgAnxiety = (s.avgAnxiety * (s.entryCount - 1) + (entry.anxiety_score || 0)) / s.entryCount;
      if (entry.temporal_urgency === 'imminent') s.hasImminentSignals = true;
    }
    for (const iso of Object.keys(subjectByGeo)) {
      const threats: Record<string, number> = {};
      for (const entry of subjectEntries.filter((e) => e.geography_iso?.toUpperCase() === iso)) {
        const threat = entry.threat_type || 'unknown';
        threats[threat] = (threats[threat] || 0) + 1;
      }
      subjectByGeo[iso].dominantThreat =
        Object.entries(threats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      subjectByGeo[iso].avgAnxiety = Math.round(subjectByGeo[iso].avgAnxiety * 10) / 10;
    }
    const subjectPoints = Object.values(subjectByGeo);

    const allAnxieties = anxietyEntries.map((entry) => entry.anxiety_score || 0);
    const globalAnxietyIndex = allAnxieties.length
      ? Math.round((allAnxieties.reduce((sum, score) => sum + score, 0) / allAnxieties.length) * 10) / 10
      : 0;

    const risingZones: string[] = [];
    for (const country of anxietyHeatmap) {
      const recentCount = anxietyEntries.filter(
        (entry) => entry.ip_country_code?.toUpperCase() === country.iso && entry.created_at >= oneDayAgo
      ).length;
      const olderCount = country.entryCount - recentCount;
      const olderDaily = olderCount / 6;
      if (recentCount > 0 && olderDaily > 0 && recentCount / olderDaily > 2) {
        risingZones.push(country.iso);
      }
    }

    return NextResponse.json({
      globalAnxietyIndex,
      totalSignals: allAnxieties.length,
      totalMatches: matchPoints.reduce((sum, match) => sum + match.matchCount, 0),
      anxietyHeatmap,
      matchPoints,
      subjectPoints,
      risingZones,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API noosphere-data] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
