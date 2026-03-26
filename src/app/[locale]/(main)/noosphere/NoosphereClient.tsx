'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { useTranslations } from 'next-intl';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type ThreatType = 'conflict' | 'disaster' | 'economic' | 'health' | 'social' | 'personal' | 'unknown';

type CountryData = {
  iso: string;
  totalAnxiety: number;
  entryCount: number;
  avgAnxiety: number;
  maxAnxiety: number;
  dominantThreat: ThreatType;
  hasConfirmedMatch: boolean;
  urgencyBreakdown: Record<string, number>;
  recentEntries: Array<{ id: string; summary: string; anxiety: number; threat: ThreatType; date: string }>;
};

type PulsingPoint = {
  iso: string;
  score: number;
  eventTitle: string;
  summary: string;
  date: string;
};

type NoosphereApiResponse = {
  globalAnxietyIndex: number;
  totalSignals: number;
  countries: CountryData[];
  pulsingPoints: PulsingPoint[];
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
  FI: [25.7482, 61.9241], CH: [8.2275, 46.8182], AT: [14.5501, 47.5162], CZ: [15.473, 49.8175], RO: [24.9668, 45.9432],
  BY: [27.9534, 53.7098], KZ: [66.9237, 48.0196], UZ: [64.5853, 41.3775], AZ: [47.5769, 40.1431], AM: [45.0382, 40.0691],
  GE: [43.3569, 42.3154], GR: [21.8243, 39.0742], PT: [-8.2245, 39.3999], IE: [-8.2439, 53.4129], CL: [-71.543, -35.6751],
  CO: [-74.2973, 4.5709], PE: [-75.0152, -9.19], VE: [-66.5897, 6.4238], NG: [8.6753, 9.082], ET: [40.4897, 9.145],
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
  Finland: 'FI', Switzerland: 'CH', Austria: 'AT', Czechia: 'CZ', Romania: 'RO',
  Belarus: 'BY', Kazakhstan: 'KZ', Uzbekistan: 'UZ', Azerbaijan: 'AZ', Armenia: 'AM',
  Georgia: 'GE', Greece: 'GR', Portugal: 'PT', Ireland: 'IE', Chile: 'CL',
  Colombia: 'CO', Peru: 'PE', Venezuela: 'VE', Nigeria: 'NG', Ethiopia: 'ET',
};

function getCircleClass(score: number): string {
  if (score < 3) return 'anxiety-circle anxiety-calm';
  if (score < 6) return 'anxiety-circle anxiety-moderate';
  if (score < 8) return 'anxiety-circle anxiety-elevated';
  return 'anxiety-circle anxiety-critical';
}

function getThreatIcon(threat: ThreatType): string {
  switch (threat) {
    case 'conflict': return '⚔️';
    case 'disaster': return '🌋';
    case 'economic': return '📉';
    case 'health': return '🧬';
    case 'social': return '👥';
    case 'personal': return '🧍';
    default: return '❔';
  }
}

function isoToFlag(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return '🏳️';
  return String.fromCodePoint(
    iso.charCodeAt(0) + 127397,
    iso.charCodeAt(1) + 127397
  );
}

export default function NoosphereClient() {
  const t = useTranslations('noosphere');
  const [data, setData] = useState<NoosphereApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; country?: CountryData; marker?: PulsingPoint; countryName?: string } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([10, 20]);
  const [mapZoom, setMapZoom] = useState(1);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const heatScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([0, 3, 5, 7, 9, 10])
        .range(['#fefce8', '#fef3c7', '#fbbf24', '#f97316', '#ef4444', '#991b1b'])
        .clamp(true),
    []
  );

  const countryByIso = useMemo(() => {
    const map = new Map<string, CountryData>();
    (data?.countries || []).forEach((c) => map.set(c.iso, c));
    return map;
  }, [data]);

  const hotZones = useMemo(
    () => [...(data?.countries || [])].sort((a, b) => b.avgAnxiety - a.avgAnxiety).slice(0, 5),
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

  const focusCountry = (iso: string) => {
    const coords = ISO_TO_COORDS[iso];
    if (!coords) return;
    setMapCenter(coords);
    setMapZoom(2.2);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 bg-gray-50 min-h-[80vh]">
        <div className="animate-pulse h-8 w-48 bg-gray-200 rounded mb-3" />
        <div className="animate-pulse h-4 w-72 bg-gray-200 rounded mb-6" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 h-[60vh] animate-pulse" />
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4 space-y-3">
          <div className="animate-pulse h-5 w-36 bg-gray-200 rounded" />
          <div className="animate-pulse h-12 w-full bg-gray-100 rounded-xl" />
          <div className="animate-pulse h-12 w-full bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={fetchData} className="btn-secondary">{t('tryAgain')}</button>
      </div>
    );
  }

  if (!data || data.totalSignals === 0 || data.countries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-2">{t('subtitle')}</p>
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-8 text-gray-600">{t('noData')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 bg-gray-50 min-h-[80vh]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={getCircleClass(data.globalAnxietyIndex)}>{data.globalAnxietyIndex.toFixed(1)}</div>
          <div>
            <p className="text-sm text-gray-500">{t('globalIndex')}</p>
            <p className="text-sm font-medium text-gray-800">{t('signals', { count: data.totalSignals })}</p>
          </div>
        </div>
      </div>

      <div ref={mapRef} className="relative bg-white rounded-2xl border border-gray-100 p-4 overflow-hidden h-[60vh] min-h-[420px]">
        <ComposableMap projection="geoMercator" projectionConfig={{ scale: 135 }} style={{ width: '100%', height: '100%' }}>
          <ZoomableGroup center={mapCenter} zoom={mapZoom} onMoveEnd={({ coordinates, zoom }) => { setMapCenter(coordinates as [number, number]); setMapZoom(zoom); }}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name as string;
                  const iso = COUNTRY_NAME_TO_ISO[countryName];
                  const country = iso ? countryByIso.get(iso) : undefined;
                  const rising = iso ? data.risingZones.includes(iso) : false;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={country ? heatScale(country.avgAnxiety) : '#f8fafc'}
                      stroke={rising ? '#f97316' : '#d1d5db'}
                      strokeWidth={rising ? 1.6 : 0.6}
                      className={rising ? 'animate-border-pulse' : ''}
                      style={{
                        default: { outline: 'none', transition: 'fill 150ms ease' },
                        hover: { outline: 'none', cursor: 'pointer', fill: country ? heatScale(Math.min(10, country.avgAnxiety + 0.4)) : '#e5e7eb' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, country, countryName })}
                      onMouseMove={(e) => setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>

            {data.pulsingPoints.map((point, idx) => {
              const coords = ISO_TO_COORDS[point.iso];
              if (!coords) return null;
              return (
                <Marker key={`${point.iso}-${idx}`} coordinates={coords}>
                  <circle
                    r={6}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1.2}
                    className="animate-pulse-red"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8))' }}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, marker: point })}
                    onMouseMove={(e) => setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        <div className="mt-2 text-xs text-gray-600">
          <div className="legend-gradient mb-2" />
          <div className="flex flex-wrap items-center gap-4">
            <span>{t('calm')} {'->'} {t('critical')}</span>
            <span>🔴 {t('legend.pulse')}</span>
            <span>🟠 {t('legend.rising')}</span>
          </div>
        </div>

        {tooltip && (
          <div className="fixed z-50 max-w-xs bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}>
            {tooltip.marker ? (
              <div>
                <p className="font-semibold">{tooltip.marker.eventTitle || t('confirmedMatch')}</p>
                <p className="text-gray-200">{Math.round(tooltip.marker.score * 100)}%</p>
                {tooltip.marker.summary ? <p className="text-gray-300 line-clamp-2">{tooltip.marker.summary}</p> : null}
              </div>
            ) : (
              <div>
                <p className="font-semibold">{tooltip.countryName}</p>
                {tooltip.country ? (
                  <>
                    <p>{t('tooltip.avgAnxiety')}: {tooltip.country.avgAnxiety}/10</p>
                    <p>{t('tooltip.signals')}: {tooltip.country.entryCount}</p>
                    <p>{t('tooltip.threat')}: {getThreatIcon(tooltip.country.dominantThreat)} {t(`threats.${tooltip.country.dominantThreat}`)}</p>
                    {tooltip.country.hasConfirmedMatch ? <p>⚡ {t('confirmedMatch')}</p> : null}
                    {tooltip.country.recentEntries.slice(0, 2).map((entry) => (
                      <p key={entry.id} className="text-gray-300 line-clamp-1">- {entry.summary}</p>
                    ))}
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('hotZones')}</h2>
        <div className="space-y-1">
          {hotZones.map((zone) => {
            const percent = Math.min(100, (zone.avgAnxiety / 10) * 100);
            const isRising = data.risingZones.includes(zone.iso);
            return (
              <div key={zone.iso} className="hot-zone-row" onClick={() => focusCountry(zone.iso)}>
                <div className="w-24 shrink-0 font-medium text-sm text-gray-800">
                  {isoToFlag(zone.iso)} {zone.iso}
                </div>
                <div className="flex-1">
                  <div className="anxiety-bar">
                    <div className="h-2 rounded-full bg-black/20" style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <div className="text-xs text-gray-600 w-24 text-right">{t('signalsCount', { count: zone.entryCount })}</div>
                <div className="text-xs text-gray-700 w-28 text-right">{getThreatIcon(zone.dominantThreat)} {t(`threats.${zone.dominantThreat}`)}</div>
                <div className="text-xs w-28 text-right">
                  {zone.hasConfirmedMatch ? <span className="text-red-600">● {t('confirmedMatch')}</span> : null}
                  {isRising ? <span className="text-orange-600 ml-2">↑ {t('rising')}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
