'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type GeoSnap = {
  id: string;
  country_iso: string;
  unique_users?: number;
  avg_anxiety: number | null;
  internal_coherence: number | null;
  entry_count: number;
  emotional_profile: {
    dominant_emotions?: Array<{ emotion: string; score: number }>;
    spectrum?: Record<string, number>;
    vs_global?: Record<string, number>;
  };
  archetype_profile: { dominant?: string[]; distribution?: Record<string, number> };
  belief_patterns: { dominant_narrative?: string; distribution?: Record<string, number> };
  dominant_symbols: Array<{ symbol: string; count: number; avgValence?: string }>;
  type_distribution: Record<string, number>;
  trends?: { anxiety_change?: number; coherence_change?: number; narrative_shift?: string };
  social_forecast?: Array<{
    state: string;
    probability: number;
    confidence: number;
    drivers: string[];
    trend: string;
  }>;
  period_start: string;
  period_end: string;
};

type GlobalSnap = {
  snapshot_date: string;
  global_emotional: {
    dominant?: string;
    spectrum?: Record<string, number>;
    trend?: string;
  };
  global_archetypes: { dominant?: string[] };
  global_beliefs: { dominant_narrative?: string; regional_variations?: Record<string, string> };
  global_coherence: number | null;
  countries_active: number;
  total_entries: number;
  total_users: number;
};

function isoToFlag(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return '🏳️';
  return String.fromCodePoint(iso.charCodeAt(0) + 127397, iso.charCodeAt(1) + 127397);
}

function anxietyColor(v: number | null): string {
  if (v == null) return 'text-text-muted';
  if (v < 4) return 'text-emerald-400';
  if (v < 6) return 'text-amber-400';
  return 'text-red-400';
}

const BELIEF_FILL: Record<string, string> = {
  conflict: '#dc2626',
  chase: '#ea580c',
  quest: '#2563eb',
  transformation: '#7c3aed',
  creation: '#16a34a',
  destruction: '#991b1b',
  loss: '#64748b',
  discovery: '#0ea5e9',
  fragmented: '#525252',
  observation: '#71717a',
  reflection: '#a78bfa',
  reunion: '#f472b6',
};

const ARCH_FILL: Record<string, string> = {
  Shadow: '#5b21b6',
  Hero: '#ca8a04',
  Explorer: '#2563eb',
  Trickster: '#ea580c',
  Magician: '#059669',
};

function mapFill(
  row: GeoSnap,
  mode: 'archetype' | 'belief' | 'anxiety'
): string {
  if (mode === 'anxiety') {
    const v = row.avg_anxiety ?? 0;
    if (v < 4) return '#10b981';
    if (v < 6) return '#eab308';
    if (v < 8) return '#f97316';
    return '#dc2626';
  }
  if (mode === 'belief') {
    const k = row.belief_patterns?.dominant_narrative || 'fragmented';
    return BELIEF_FILL[k] || '#525252';
  }
  const d = row.archetype_profile?.dominant?.[0] || '';
  for (const [k, c] of Object.entries(ARCH_FILL)) {
    if (d.toLowerCase().includes(k.toLowerCase())) return c;
  }
  return '#6366f1';
}

export default function PsycheDashboard() {
  const t = useTranslations('admin.psyche');
  const tSf = useTranslations('socialForecast');

  const [global, setGlobal] = useState<GlobalSnap | null>(null);
  const [geo, setGeo] = useState<GeoSnap[]>([]);
  const [trends, setTrends] = useState<{
    anxiety_7d: Array<{ date: string; value: number | null }>;
    coherence_7d: Array<{ date: string; value: number | null }>;
  }>({ anxiety_7d: [], coherence_7d: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [mapColor, setMapColor] = useState<'archetype' | 'belief' | 'anxiety'>('archetype');
  const [sortKey, setSortKey] = useState<
    'country' | 'anxiety' | 'archetype' | 'belief' | 'coherence' | 'entries' | 'trend'
  >('entries');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<GeoSnap | null>(null);
  const [countryHistory, setCountryHistory] = useState<GeoSnap[]>([]);

  const loadMain = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/psyche-data?view=global&period=6h', { cache: 'no-store' });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = (await res.json()) as {
      global: GlobalSnap | null;
      geo: GeoSnap[];
      trends: {
        anxiety_7d: Array<{ date: string; value: number | null }>;
        coherence_7d: Array<{ date: string; value: number | null }>;
      };
    };
    setGlobal(json.global);
    setGeo(json.geo || []);
    setTrends(json.trends || { anxiety_7d: [], coherence_7d: [] });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  const loadCountry = useCallback(async (iso: string) => {
    const res = await fetch(
      `/api/admin/psyche-data?view=country&country_iso=${encodeURIComponent(iso)}&period=6h`,
      { cache: 'no-store' }
    );
    if (!res.ok) return;
    const json = (await res.json()) as { country: GeoSnap | null; country_history: GeoSnap[] };
    setCountryDetail(json.country);
    setCountryHistory(json.country_history || []);
  }, []);

  useEffect(() => {
    if (selectedIso) void loadCountry(selectedIso);
  }, [selectedIso, loadCountry]);

  const sortedGeo = useMemo(() => {
    const rows = [...geo];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'country':
          cmp = a.country_iso.localeCompare(b.country_iso);
          break;
        case 'anxiety':
          cmp = (a.avg_anxiety ?? -1) - (b.avg_anxiety ?? -1);
          break;
        case 'archetype':
          cmp = (a.archetype_profile?.dominant?.[0] || '').localeCompare(
            b.archetype_profile?.dominant?.[0] || ''
          );
          break;
        case 'belief':
          cmp = (a.belief_patterns?.dominant_narrative || '').localeCompare(
            b.belief_patterns?.dominant_narrative || ''
          );
          break;
        case 'coherence':
          cmp = (a.internal_coherence ?? -1) - (b.internal_coherence ?? -1);
          break;
        case 'entries':
          cmp = a.entry_count - b.entry_count;
          break;
        case 'trend':
          cmp = (a.trends?.anxiety_change ?? 0) - (b.trends?.anxiety_change ?? 0);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return rows;
  }, [geo, sortKey, sortDir]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'country' ? 'asc' : 'desc');
    }
  };

  const spectrumTop = useMemo(() => {
    const sp = global?.global_emotional?.spectrum || {};
    return Object.entries(sp)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [global]);

  const lineCombo = useMemo(() => {
    const a = trends.anxiety_7d || [];
    const c = trends.coherence_7d || [];
    const dates = new Set([...a.map((x) => x.date), ...c.map((x) => x.date)]);
    return Array.from(dates)
      .sort()
      .map((date) => ({
        date,
        anxiety: a.find((x) => x.date === date)?.value ?? null,
        coherence: c.find((x) => x.date === date)?.value ?? null,
      }));
  }, [trends]);

  const countryLine = useMemo(() => {
    return countryHistory.map((h) => ({
      label: format(parseISO(h.period_start), 'MM-dd HH:mm'),
      anxiety: h.avg_anxiety,
      coherence: h.internal_coherence,
    }));
  }, [countryHistory]);

  if (loading) {
    return (
      <div className="text-text-muted">{t('loading')}</div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>

      {/* Global */}
      <section className="rounded-2xl border border-border/30 bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {t('globalTitle')}{' '}
          {global?.snapshot_date
            ? `· ${format(parseISO(global.snapshot_date), 'd MMM yyyy')}`
            : ''}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/30 bg-bg/40 p-4">
            <p className="text-xs text-text-muted">{t('cardAnxiety')}</p>
            <p className={`text-2xl font-bold ${anxietyColor(
              global?.global_emotional?.spectrum?.anxiety != null
                ? global.global_emotional.spectrum.anxiety * 10
                : null
            )}`}>
              {global?.global_emotional?.spectrum?.anxiety != null
                ? (global.global_emotional.spectrum.anxiety * 10).toFixed(1)
                : '—'}
            </p>
            <div className="mt-2 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineCombo}>
                  <Line type="monotone" dataKey="anxiety" stroke="#94a3b8" dot={false} strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border/30 bg-bg/40 p-4">
            <p className="text-xs text-text-muted">{t('cardArchetype')}</p>
            <p className="text-xl font-semibold text-text-primary">
              {global?.global_archetypes?.dominant?.[0] || '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-bg/40 p-4">
            <p className="text-xs text-text-muted">{t('cardBelief')}</p>
            <p className="text-xl font-semibold text-text-primary">
              {global?.global_beliefs?.dominant_narrative
                ? t(`belief.${global.global_beliefs.dominant_narrative}`, {
                    default: global.global_beliefs.dominant_narrative,
                  })
                : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-bg/40 p-4">
            <p className="text-xs text-text-muted">{t('cardCountries')}</p>
            <p className="text-2xl font-bold text-text-primary">{global?.countries_active ?? '—'}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm text-text-muted">{t('emotionSpectrum')}</p>
          <div className="flex flex-wrap gap-1">
            {spectrumTop.map(([k, v]) => (
              <div
                key={k}
                className="flex min-w-[120px] flex-1 flex-col rounded-lg bg-bg/50 px-2 py-1"
                title={`${k}: ${(v * 100).toFixed(0)}%`}
              >
                <span className="truncate text-xs text-text-muted">{k}</span>
                <div className="h-2 w-full overflow-hidden rounded bg-border/40">
                  <div
                    className="h-full bg-violet-500/70"
                    style={{ width: `${Math.min(100, v * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm text-text-muted">{t('regionalBeliefs')}</p>
          <div className="flex flex-wrap gap-2 text-sm text-text-secondary">
            {Object.entries(global?.global_beliefs?.regional_variations || {})
              .slice(0, 12)
              .map(([iso, nar]) => (
                <span key={iso} className="rounded-lg border border-border/40 px-2 py-1">
                  {isoToFlag(iso)} {iso}: {t(`belief.${nar}`, { default: String(nar) })}
                </span>
              ))}
          </div>
        </div>

        <div className="mt-6 h-48">
          <p className="mb-2 text-sm text-text-muted">{t('coherenceTrend')}</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineCombo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="anxiety" name="anxiety" stroke="#a78bfa" dot={false} />
              <Line type="monotone" dataKey="coherence" name="coherence" stroke="#38bdf8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Geo */}
      <section className="rounded-2xl border border-border/30 bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{t('geoTitle')}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-lg px-3 py-1 text-sm ${viewMode === 'table' ? 'bg-violet-600 text-white' : 'bg-bg/50 text-text-muted'}`}
            >
              {t('modeTable')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`rounded-lg px-3 py-1 text-sm ${viewMode === 'map' ? 'bg-violet-600 text-white' : 'bg-bg/50 text-text-muted'}`}
            >
              {t('modeMap')}
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/40 text-text-muted">
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('country')}>
                    {t('colCountry')}
                  </th>
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('anxiety')}>
                    {t('colAnxiety')}
                  </th>
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('archetype')}>
                    {t('colArchetype')}
                  </th>
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('belief')}>
                    {t('colBelief')}
                  </th>
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('coherence')}>
                    {t('colCoherence')}
                  </th>
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('entries')}>
                    {t('colEntries')}
                  </th>
                  <th className="cursor-pointer p-2" onClick={() => toggleSort('trend')}>
                    {t('colTrend')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGeo.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border/20 hover:bg-bg/40"
                    onClick={() => setSelectedIso(row.country_iso)}
                  >
                    <td className="p-2 text-text-primary">
                      {isoToFlag(row.country_iso)} {row.country_iso}
                    </td>
                    <td className={`p-2 font-medium ${anxietyColor(row.avg_anxiety)}`}>
                      {row.avg_anxiety ?? '—'}
                    </td>
                    <td className="p-2 text-text-secondary">
                      {row.archetype_profile?.dominant?.[0] || '—'}
                    </td>
                    <td className="p-2 text-text-secondary">
                      {row.belief_patterns?.dominant_narrative
                        ? t(`belief.${row.belief_patterns.dominant_narrative}`, {
                            default: row.belief_patterns.dominant_narrative,
                          })
                        : '—'}
                    </td>
                    <td className="p-2 text-text-secondary">
                      {row.internal_coherence != null ? row.internal_coherence.toFixed(2) : '—'}
                    </td>
                    <td className="p-2 text-text-secondary">{row.entry_count}</td>
                    <td className="p-2 text-text-secondary">
                      {row.trends?.anxiety_change != null
                        ? `${row.trends.anxiety_change > 0 ? '▲' : row.trends.anxiety_change < 0 ? '▼' : '→'} ${row.trends.anxiety_change}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="text-text-muted">{t('mapColor')}:</span>
              {(['archetype', 'belief', 'anxiety'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMapColor(m)}
                  className={`rounded px-2 py-0.5 ${mapColor === m ? 'bg-violet-600 text-white' : 'bg-bg/50 text-text-muted'}`}
                >
                  {t(`mapMode.${m}`)}
                </button>
              ))}
            </div>
            <div className="h-[420px] w-full overflow-hidden rounded-xl border border-border/40">
              <ComposableMap projectionConfig={{ scale: 140 }} width={800} height={420}>
                <ZoomableGroup center={[20, 30]} zoom={0.8}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geoG) => {
                        const iso = COUNTRY_NAME_TO_ISO[geoG.properties.name as string];
                        const row = iso ? geo.find((g) => g.country_iso === iso) : undefined;
                        const fill = row ? mapFill(row, mapColor) : '#1e293b';
                        return (
                          <Geography
                            key={geoG.rsmKey}
                            geography={geoG}
                            fill={fill}
                            stroke="#334155"
                            strokeWidth={0.4}
                            style={{
                              default: { outline: 'none' },
                              hover: { fill: row ? fill : '#334155', outline: 'none' },
                              pressed: { outline: 'none' },
                            }}
                            onClick={() => {
                              if (iso && row) setSelectedIso(iso);
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            </div>
          </div>
        )}
      </section>

      {/* Detail panel */}
      {selectedIso && countryDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/40 bg-surface p-6 shadow-xl">
            <div className="mb-4 flex justify-between gap-2">
              <h3 className="text-lg font-semibold text-text-primary">
                {isoToFlag(selectedIso)} {selectedIso} — {t('detailTitle')}
              </h3>
              <button
                type="button"
                className="text-text-muted hover:text-text-primary"
                onClick={() => {
                  setSelectedIso(null);
                  setCountryDetail(null);
                }}
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-text-muted">
              {t('detailMeta', {
                entries: countryDetail.entry_count,
                users: countryDetail.unique_users ?? 0,
              })}
            </p>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{t('emotionProfile')}</h4>
            <div className="mb-4 h-56">
              {(countryDetail.emotional_profile?.dominant_emotions || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={(countryDetail.emotional_profile?.dominant_emotions || []).slice(0, 5).map((d) => ({
                      subject: d.emotion,
                      a: d.score,
                      fullMark: 1,
                    }))}
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar dataKey="a" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-text-muted">—</p>
              )}
            </div>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{t('archetypeProfile')}</h4>
            <div className="mb-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={Object.entries(countryDetail.archetype_profile?.distribution || {}).map(([name, v]) => ({
                    name,
                    v: Math.round(v * 100),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="v" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{t('beliefDominant')}</h4>
            <p className="mb-4 text-text-secondary">
              {countryDetail.belief_patterns?.dominant_narrative
                ? t(`belief.${countryDetail.belief_patterns.dominant_narrative}`, {
                    default: countryDetail.belief_patterns.dominant_narrative,
                  })
                : '—'}
            </p>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{t('symbols')}</h4>
            <p className="mb-4 text-sm text-text-secondary">
              {(countryDetail.dominant_symbols || [])
                .slice(0, 8)
                .map((s) => `${s.symbol} (${s.count})`)
                .join(' · ')}
            </p>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{t('entryTypes')}</h4>
            <div className="mb-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(countryDetail.type_distribution || {}).map(([name, value]) => ({
                      name,
                      value,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={56}
                    label
                  >
                    {Object.keys(countryDetail.type_distribution || {}).map((_, i) => (
                      <Cell key={i} fill={['#6366f1', '#a78bfa', '#38bdf8', '#f472b6', '#34d399'][i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{t('trend7d')}</h4>
            <div className="mb-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={countryLine}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="anxiety" stroke="#f472b6" dot={false} />
                  <Line type="monotone" dataKey="coherence" stroke="#38bdf8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <h4 className="mb-2 text-sm font-medium text-text-primary">{tSf('title')}</h4>
            <ul className="space-y-2">
              {(countryDetail.social_forecast || []).map((sf) => (
                <li key={sf.state} className="rounded-lg border border-border/30 bg-bg/40 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-text-primary">{tSf(`states.${sf.state}`)}</span>
                    <span className="text-text-muted">{(sf.probability * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-border/40">
                    <div
                      className="h-full bg-amber-500/80"
                      style={{ width: `${Math.min(100, sf.probability * 100)}%` }}
                    />
                  </div>
                  {sf.drivers?.length ? (
                    <p className="mt-1 text-xs text-text-muted">
                      {tSf('drivers')}: {sf.drivers.join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {selectedIso && !countryDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl bg-surface px-6 py-4 text-text-primary">{t('loading')}</div>
        </div>
      ) : null}
    </div>
  );
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  Russia: 'RU',
  'United States of America': 'US',
  China: 'CN',
  India: 'IN',
  Brazil: 'BR',
  Germany: 'DE',
  France: 'FR',
  'United Kingdom': 'GB',
  Italy: 'IT',
  Spain: 'ES',
  Ukraine: 'UA',
  Turkey: 'TR',
  Iran: 'IR',
  Israel: 'IL',
  Japan: 'JP',
  Canada: 'CA',
  Australia: 'AU',
  Mexico: 'MX',
  Argentina: 'AR',
  'South Africa': 'ZA',
  Egypt: 'EG',
  'Saudi Arabia': 'SA',
  Iraq: 'IQ',
  Syria: 'SY',
  Afghanistan: 'AF',
  Pakistan: 'PK',
  Indonesia: 'ID',
  'South Korea': 'KR',
  Poland: 'PL',
  Netherlands: 'NL',
  Belgium: 'BE',
  Sweden: 'SE',
  Norway: 'NO',
};
