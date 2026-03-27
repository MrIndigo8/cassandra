'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { useSearchParams } from 'next/navigation';
import MatchDetail from '@/components/MatchDetail';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type ThreatType = 'conflict' | 'disaster' | 'economic' | 'health' | 'social' | 'personal' | 'unknown';

type AnxietyCountry = {
  iso: string;
  totalAnxiety: number;
  entryCount: number;
  avgAnxiety: number;
  maxAnxiety: number;
  panicCount: number;
};

type MatchPoint = {
  iso: string;
  matchCount: number;
  avgScore: number;
  topMatch: {
    id: string;
    entryId: string;
    geographyIso: string;
    score: number;
    eventTitle: string;
    eventDate: string;
    eventUrl: string | null;
    entrySummary: string;
    entryContent: string;
    threatType: ThreatType | string;
    matchedSymbols: string[];
    authorUsername: string;
    authorCountry: string | null;
    daysBefore: number;
  };
  allMatches: Array<{ score: number; eventTitle: string; threatType: string }>;
};

type SubjectPoint = {
  iso: string;
  entryCount: number;
  avgAnxiety: number;
  dominantThreat: ThreatType | string;
  hasImminentSignals: boolean;
};

type NoosphereApiResponse = {
  globalAnxietyIndex: number;
  totalSignals: number;
  totalMatches: number;
  anxietyHeatmap: AnxietyCountry[];
  matchPoints: MatchPoint[];
  subjectPoints: SubjectPoint[];
  risingZones: string[];
  updatedAt: string;
};

const ISO_TO_COORDS: Record<string, [number, number]> = {
  RU: [105.3188, 61.524], US: [-95.7129, 37.0902], CN: [104.1954, 35.8617], IN: [78.9629, 20.5937], BR: [-51.9253, -14.235],
  DE: [10.4515, 51.1657], FR: [2.2137, 46.2276], GB: [-3.436, 55.3781], IT: [12.5674, 41.8719], ES: [-3.7492, 40.4637],
  UA: [31.1656, 48.3794], TR: [35.2433, 38.9637], IR: [53.688, 32.4279], IL: [34.8516, 31.0461], JP: [138.2529, 36.2048],
  CA: [-106.3468, 56.1304], AU: [133.7751, -25.2744], MX: [-102.5528, 23.6345], AR: [-63.6167, -38.4161], ZA: [22.9375, -30.5595],
  EG: [30.8025, 26.8206], SA: [45.0792, 23.8859], IQ: [43.6793, 33.2232], SY: [38.9968, 34.8021], AF: [67.7099, 33.9391],
  PK: [69.3451, 30.3753], ID: [113.9213, -0.7893], KR: [127.7669, 35.9078], KP: [127.5101, 40.3399], VN: [108.2772, 14.0583],
  TH: [100.9925, 15.87], MY: [101.9758, 4.2105], PH: [121.774, 12.8797], SG: [103.8198, 1.3521], NZ: [174.886, -40.9006],
  PL: [19.1451, 51.9194], NL: [5.2913, 52.1326], BE: [4.4699, 50.5039], SE: [18.6435, 60.1282], NO: [8.4689, 60.472],
};

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  Russia: 'RU', 'United States of America': 'US', China: 'CN', India: 'IN', Brazil: 'BR',
  Germany: 'DE', France: 'FR', 'United Kingdom': 'GB', Italy: 'IT', Spain: 'ES',
  Ukraine: 'UA', Turkey: 'TR', Iran: 'IR', Israel: 'IL', Japan: 'JP',
  Canada: 'CA', Australia: 'AU', Mexico: 'MX', Argentina: 'AR', 'South Africa': 'ZA',
  Egypt: 'EG', 'Saudi Arabia': 'SA', Iraq: 'IQ', Syria: 'SY', Afghanistan: 'AF',
  Pakistan: 'PK', Indonesia: 'ID', 'South Korea': 'KR', 'North Korea': 'KP', Vietnam: 'VN',
  Thailand: 'TH', Malaysia: 'MY', Philippines: 'PH', Singapore: 'SG', 'New Zealand': 'NZ',
  Poland: 'PL', Netherlands: 'NL', Belgium: 'BE', Sweden: 'SE', Norway: 'NO',
};

function getCircleClass(score: number): string {
  if (score < 3) return 'anxiety-circle anxiety-calm';
  if (score < 6) return 'anxiety-circle anxiety-moderate';
  if (score < 8) return 'anxiety-circle anxiety-elevated';
  return 'anxiety-circle anxiety-critical';
}

function getThreatIcon(threat: string): string {
  switch (threat) {
    case 'conflict': return '⚔️';
    case 'disaster': return '🌍';
    case 'economic': return '📉';
    case 'health': return '🏥';
    case 'social': return '👥';
    case 'personal': return '🧍';
    default: return '❔';
  }
}

function isoToFlag(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return '🏳️';
  return String.fromCodePoint(iso.charCodeAt(0) + 127397, iso.charCodeAt(1) + 127397);
}

export default function NoosphereClient() {
  const t = useTranslations('noosphere');
  const searchParams = useSearchParams();
  const [data, setData] = useState<NoosphereApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<
    | { x: number; y: number; kind: 'anxiety'; countryName: string; country?: AnxietyCountry }
    | { x: number; y: number; kind: 'match'; point: MatchPoint }
    | { x: number; y: number; kind: 'subject'; point: SubjectPoint }
    | null
  >(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchPoint | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([10, 20]);
  const [mapZoom, setMapZoom] = useState(1);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const lastTooltipMoveRef = useRef(0);
  const highlightISO = (searchParams.get('highlight') || '').toUpperCase();
  const highlightMatchId = searchParams.get('match');

  const heatScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([0, 3, 5, 7, 9, 10])
        .range(['#f8fafc', '#fef3c7', '#fdba74', '#f87171', '#ef4444', '#991b1b'])
        .clamp(true),
    []
  );

  const anxietyByIso = useMemo(() => {
    const map = new Map<string, AnxietyCountry>();
    (data?.anxietyHeatmap || []).forEach((row) => map.set(row.iso, row));
    return map;
  }, [data]);

  const worriedZones = useMemo(
    () => [...(data?.anxietyHeatmap || [])].sort((a, b) => b.avgAnxiety - a.avgAnxiety).slice(0, 5),
    [data]
  );
  const confirmedMatches = useMemo(
    () => [...(data?.matchPoints || [])].sort((a, b) => b.topMatch.score - a.topMatch.score).slice(0, 8),
    [data]
  );

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/noosphere-data', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch noosphere data');
      const json = (await response.json()) as NoosphereApiResponse;
      setData(json);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  const focusCountry = useCallback((iso: string) => {
    const coords = ISO_TO_COORDS[iso];
    if (!coords) return;
    setMapCenter(coords);
    setMapZoom(2.2);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    if (!data) return;
    if (highlightISO) {
      focusCountry(highlightISO);
    }
    if (highlightMatchId) {
      const pointed = data.matchPoints.find((point) => point.topMatch.id === highlightMatchId);
      if (pointed) {
        setSelectedMatch(pointed);
        focusCountry(pointed.iso);
      }
    }
  }, [data, highlightISO, highlightMatchId, focusCountry]);

  const handleTooltipMove = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastTooltipMoveRef.current < 40) return;
    lastTooltipMoveRef.current = now;
    setTooltip((prev) => (prev ? { ...prev, x, y } : prev));
  }, []);

  const handleMapMoveEnd = useCallback(({ coordinates, zoom }: { coordinates: number[]; zoom: number }) => {
    setMapCenter(coordinates as [number, number]);
    setMapZoom(zoom);
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 min-h-[80vh]">
        <div className="animate-pulse h-8 w-48 bg-surface rounded mb-3" />
        <div className="animate-pulse h-4 w-72 bg-surface rounded mb-6" />
        <div className="card rounded-2xl border-border p-4 h-[60vh] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-text-secondary mb-4">{error}</p>
        <button onClick={fetchData} className="btn-secondary">{t('tryAgain')}</button>
      </div>
    );
  }

  if (!data || (data.anxietyHeatmap.length === 0 && data.matchPoints.length === 0)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <h1 className="text-3xl font-bold text-text-primary">{t('title')}</h1>
        <p className="text-text-secondary mt-2">{t('subtitle')}</p>
        <div className="mt-8 card rounded-2xl border-border p-8 text-text-secondary">
          <p>{t('emptyMap')}</p>
          <Link href="/feed" className="btn-primary inline-flex mt-4">{t('writeFirst')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 min-h-[80vh]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-text-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={getCircleClass(data.globalAnxietyIndex)}>{data.globalAnxietyIndex.toFixed(1)}</div>
          <div>
            <p className="text-sm text-text-secondary">{t('globalIndex')}</p>
            <p className="text-sm font-medium text-text-primary">{t('signals', { count: data.totalSignals })}</p>
            <p className="text-xs text-text-muted mt-1">{t('confirmedMatch')}: {data.totalMatches}</p>
          </div>
        </div>
      </div>

      <div ref={mapRef} className="relative card rounded-2xl border-border p-4 overflow-hidden h-[60vh] min-h-[420px]">
        <ComposableMap projection="geoMercator" projectionConfig={{ scale: 135 }} style={{ width: '100%', height: '100%' }}>
          <ZoomableGroup center={mapCenter} zoom={mapZoom} onMoveEnd={handleMapMoveEnd}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name as string;
                  const iso = COUNTRY_NAME_TO_ISO[countryName];
                  const anxietyCountry = iso ? anxietyByIso.get(iso) : undefined;
                  const rising = iso ? data.risingZones.includes(iso) : false;
                  const highlighted = Boolean(iso && highlightISO && iso === highlightISO);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={anxietyCountry ? heatScale(anxietyCountry.avgAnxiety) : '#f8fafc'}
                      stroke={highlighted ? '#f59e0b' : rising ? '#f97316' : '#d1d5db'}
                      strokeWidth={highlighted ? 2 : rising ? 1.5 : 0.6}
                      className={highlighted || rising ? 'animate-border-pulse' : ''}
                      style={{
                        default: { outline: 'none', transition: 'fill 150ms ease' },
                        hover: {
                          outline: 'none',
                          cursor: 'pointer',
                          fill: anxietyCountry ? heatScale(Math.min(10, anxietyCountry.avgAnxiety + 0.4)) : '#e5e7eb',
                        },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, kind: 'anxiety', countryName, country: anxietyCountry })}
                      onMouseMove={(e) => handleTooltipMove(e.clientX, e.clientY)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>

            {data.subjectPoints.map((point) => {
              const coords = ISO_TO_COORDS[point.iso];
              if (!coords) return null;
                  const colorMap: Record<string, string> = {
                conflict: '#ef4444',
                disaster: '#f97316',
                economic: '#fbbf24',
                health: '#10b981',
                social: '#8b5cf6',
                unknown: '#9ca3af',
              };
              return (
                <Marker key={`subject-${point.iso}`} coordinates={coords}>
                  <circle
                    r={4}
                    fill={colorMap[point.dominantThreat] || '#9ca3af'}
                    fillOpacity={0.45}
                    stroke="#0b1230"
                    strokeWidth={0.7}
                    className={point.hasImminentSignals ? 'animate-pulse' : ''}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, kind: 'subject', point })}
                    onMouseMove={(e) => handleTooltipMove(e.clientX, e.clientY)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </Marker>
              );
            })}

            {data.matchPoints.map((point, idx) => {
              const coords = ISO_TO_COORDS[point.iso];
              if (!coords) return null;
              const size = point.matchCount >= 4 ? 10 : point.matchCount >= 2 ? 8 : 6;
              return (
                <Marker key={`${point.iso}-${idx}`} coordinates={coords}>
                  <circle
                    r={size}
                    fill="#ef4444"
                    stroke="#0b1230"
                    strokeWidth={1.2}
                    className="animate-pulse-red"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8))' }}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, kind: 'match', point })}
                    onMouseMove={(e) => handleTooltipMove(e.clientX, e.clientY)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => setSelectedMatch(point)}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        <div className="mt-2 text-xs text-text-secondary">
          <div className="legend-gradient mb-2" />
          <div className="flex flex-wrap items-center gap-4">
            <span>🟡→🔴 {t('legend.heatmap')}</span>
            <span>🔴 {t('legend.pulse')}</span>
            <span>⚪ {t('legend.subject')}</span>
          </div>
        </div>

        {tooltip && (
          <div className="fixed z-50 max-w-xs bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}>
            {tooltip.kind === 'match' ? (
              <div>
                <p className="font-semibold">{tooltip.point.iso} — {getThreatIcon(tooltip.point.topMatch.threatType)} {t(`threats.${tooltip.point.topMatch.threatType}`)}</p>
                <p className="text-gray-200">{t('matchCard.match', { score: Math.round(tooltip.point.topMatch.score * 100) })}</p>
                <p className="text-gray-300 line-clamp-2">{`"${tooltip.point.topMatch.entrySummary}"`}</p>
                <p className="text-gray-300">{t('matchCard.author')}: {tooltip.point.topMatch.authorUsername} ({tooltip.point.topMatch.authorCountry || '--'})</p>
                <p className="text-gray-300">{t('matchCard.daysBefore', { days: tooltip.point.topMatch.daysBefore })}</p>
              </div>
            ) : tooltip.kind === 'subject' ? (
              <div>
                <p className="font-semibold">{tooltip.point.iso}</p>
                <p>{t('tooltip.signals')}: {tooltip.point.entryCount}</p>
                <p>{t('tooltip.avgAnxiety')}: {tooltip.point.avgAnxiety}/10</p>
                <p>{t('tooltip.threat')}: {getThreatIcon(tooltip.point.dominantThreat)} {t(`threats.${tooltip.point.dominantThreat}`)}</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold">{tooltip.countryName}</p>
                {tooltip.country ? (
                  <>
                    <p>{t('layers.anxiety')}: {tooltip.country.avgAnxiety}/10</p>
                    <p>{t('tooltip.signals')}: {tooltip.country.entryCount}</p>
                    {data.risingZones.includes(tooltip.country.iso) ? <p>↑ {t('rising')}</p> : null}
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card rounded-2xl border-border p-5 mt-4">
        <h2 className="text-lg font-semibold text-text-primary mb-3">{t('sections.whereWorried')}</h2>
        <div className="space-y-1 mb-6">
          {worriedZones.map((zone) => {
            const percent = Math.min(100, (zone.avgAnxiety / 10) * 100);
            const isRising = data.risingZones.includes(zone.iso);
            return (
              <div key={zone.iso} className="hot-zone-row" onClick={() => focusCountry(zone.iso)}>
                <div className="w-24 shrink-0 font-medium text-sm text-text-primary">{isoToFlag(zone.iso)} {zone.iso}</div>
                <div className="flex-1">
                  <div className="anxiety-bar">
                    <div className="h-2 rounded-full bg-black/20" style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <div className="text-xs text-text-secondary w-28 text-right">{t('signalsCount', { count: zone.entryCount })}</div>
                <div className="text-xs w-24 text-right">{isRising ? <span className="text-orange-600">↑ {t('rising')}</span> : null}</div>
              </div>
            );
          })}
        </div>

        <h2 className="text-lg font-semibold text-text-primary mb-3">{t('sections.confirmedMatches')}</h2>
        <div className="mb-2">
          <Link href="/discoveries?tab=matches" className="text-sm text-primary hover:underline">All matches</Link>
        </div>
        {confirmedMatches.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('noMatchesYet')}</p>
        ) : (
          <div className="space-y-2">
            {confirmedMatches.map((item) => (
              <div key={item.iso + item.topMatch.id} className="border border-border rounded-xl p-3 hover:bg-surface cursor-pointer" onClick={() => { focusCountry(item.iso); setSelectedMatch(item); }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary line-clamp-2">{`"${item.topMatch.entrySummary}"`}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {t('matchCard.author')}: {item.topMatch.authorUsername} {t('matchCard.from')} {item.topMatch.authorCountry || '--'} - {t('matchCard.daysBefore', { days: item.topMatch.daysBefore })}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-sm font-bold">
                    {Math.round(item.topMatch.score * 100)}%
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-text-secondary line-clamp-1">{getThreatIcon(item.topMatch.threatType)} {item.topMatch.eventTitle}</p>
                  <p className="text-xs text-text-muted">{isoToFlag(item.topMatch.authorCountry || '--')} → {isoToFlag(item.iso)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMatch ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedMatch(null)}>
          <div className="card rounded-2xl border border-border p-5 max-w-xl w-full relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="absolute top-3 right-3 text-text-muted hover:text-text-primary" onClick={() => setSelectedMatch(null)}>×</button>
            <MatchDetail
              variant="compact"
              match={{
                id: selectedMatch.topMatch.id,
                entry_id: selectedMatch.topMatch.entryId,
                similarity_score: selectedMatch.topMatch.score,
                matched_symbols: selectedMatch.topMatch.matchedSymbols || [],
                event_title: selectedMatch.topMatch.eventTitle,
                event_description: null,
                event_url: selectedMatch.topMatch.eventUrl,
                event_date: selectedMatch.topMatch.eventDate,
                created_at: selectedMatch.topMatch.eventDate,
                geography_match: {
                  entry_geography: selectedMatch.topMatch.authorCountry,
                  event_geography: selectedMatch.topMatch.geographyIso || selectedMatch.iso,
                  match_type: 'region',
                },
              }}
              entry={{
                id: selectedMatch.topMatch.entryId,
                title: selectedMatch.topMatch.entrySummary,
                content: selectedMatch.topMatch.entryContent || selectedMatch.topMatch.entrySummary,
                type: 'vision',
                created_at: selectedMatch.topMatch.eventDate,
              }}
              showEntryLink
              showEventLink
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
