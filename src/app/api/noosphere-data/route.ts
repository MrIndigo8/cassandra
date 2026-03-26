import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type EntryRow = {
  id: string;
  anxiety_score: number | null;
  threat_type: string | null;
  temporal_urgency: string | null;
  emotional_intensity: string | null;
  geography_iso: string | null;
  ai_summary: string | null;
  created_at: string;
  best_match_score: number | null;
  is_verified: boolean | null;
};

type MatchRow = {
  similarity_score: number | null;
  event_title: string | null;
  created_at: string;
  entries:
    | {
        geography_iso: string | null;
        anxiety_score: number | null;
        ai_summary: string | null;
      }
    | Array<{
        geography_iso: string | null;
        anxiety_score: number | null;
        ai_summary: string | null;
      }>
    | null;
};

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: entriesRaw, error: entriesError } = await supabase
      .from('entries')
      .select('id, anxiety_score, threat_type, temporal_urgency, emotional_intensity, geography_iso, ai_summary, created_at, best_match_score, is_verified')
      .not('geography_iso', 'is', null)
      .not('anxiety_score', 'is', null)
      .gte('created_at', sevenDaysAgo)
      .gte('anxiety_score', 3)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    const entries = (entriesRaw || []) as EntryRow[];

    const countryMap: Record<
      string,
      {
        iso: string;
        totalAnxiety: number;
        entryCount: number;
        avgAnxiety: number;
        maxAnxiety: number;
        dominantThreat: string;
        hasConfirmedMatch: boolean;
        urgencyBreakdown: Record<string, number>;
        threatBreakdown: Record<string, number>;
        recentEntries: Array<{ id: string; summary: string; anxiety: number; threat: string; date: string }>;
      }
    > = {};

    for (const entry of entries) {
      const iso = (entry.geography_iso || '').toUpperCase();
      if (!iso) continue;

      if (!countryMap[iso]) {
        countryMap[iso] = {
          iso,
          totalAnxiety: 0,
          entryCount: 0,
          avgAnxiety: 0,
          maxAnxiety: 0,
          dominantThreat: 'unknown',
          hasConfirmedMatch: false,
          urgencyBreakdown: {},
          threatBreakdown: {},
          recentEntries: [],
        };
      }

      const c = countryMap[iso];
      const anxiety = entry.anxiety_score || 0;
      const threat = entry.threat_type || 'unknown';
      const urgency = entry.temporal_urgency || 'unclear';

      c.totalAnxiety += anxiety;
      c.entryCount += 1;
      c.maxAnxiety = Math.max(c.maxAnxiety, anxiety);
      c.urgencyBreakdown[urgency] = (c.urgencyBreakdown[urgency] || 0) + 1;
      c.threatBreakdown[threat] = (c.threatBreakdown[threat] || 0) + 1;

      if (entry.is_verified && entry.best_match_score && entry.best_match_score > 0.6) {
        c.hasConfirmedMatch = true;
      }

      if (c.recentEntries.length < 5) {
        c.recentEntries.push({
          id: entry.id,
          summary: entry.ai_summary || '',
          anxiety,
          threat,
          date: entry.created_at,
        });
      }
    }

    const countries = Object.values(countryMap).map((country) => {
      country.avgAnxiety = Math.round((country.totalAnxiety / country.entryCount) * 10) / 10;
      country.dominantThreat =
        Object.entries(country.threatBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      return country;
    });

    const allAnxieties = entries.map((e) => e.anxiety_score || 0);
    const globalAnxietyIndex =
      allAnxieties.length > 0
        ? Math.round((allAnxieties.reduce((sum, score) => sum + score, 0) / allAnxieties.length) * 10) / 10
        : 0;

    const { data: confirmedRaw, error: confirmedError } = await supabase
      .from('matches')
      .select('similarity_score, event_title, created_at, entries:entry_id (geography_iso, anxiety_score, ai_summary)')
      .gt('similarity_score', 0.6)
      .gte('created_at', sevenDaysAgo)
      .limit(20);

    if (confirmedError) {
      return NextResponse.json({ error: confirmedError.message }, { status: 500 });
    }

    const confirmedMatches = (confirmedRaw || []) as MatchRow[];
    const pulsingPoints = confirmedMatches
      .map((match) => {
        const matchEntry = Array.isArray(match.entries) ? match.entries[0] : match.entries;
        if (!matchEntry?.geography_iso) return null;
        return {
          iso: matchEntry.geography_iso.toUpperCase(),
          score: match.similarity_score || 0,
          eventTitle: match.event_title || '',
          summary: matchEntry.ai_summary || '',
          date: match.created_at,
        };
      })
      .filter(Boolean);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const risingZones: string[] = [];

    for (const country of countries) {
      const recent = entries.filter((e) => e.geography_iso?.toUpperCase() === country.iso && e.created_at >= oneDayAgo).length;
      const older = country.entryCount - recent;
      const olderDaily = older / 6;

      if (recent > 0 && olderDaily > 0 && recent / olderDaily > 2) {
        risingZones.push(country.iso);
      }
      if ((country.urgencyBreakdown.imminent || 0) > country.entryCount * 0.5 && !risingZones.includes(country.iso)) {
        risingZones.push(country.iso);
      }
    }

    return NextResponse.json({
      globalAnxietyIndex,
      totalSignals: entries.length,
      countries,
      pulsingPoints,
      risingZones,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API noosphere-data] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
