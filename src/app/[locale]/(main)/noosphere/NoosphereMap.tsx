'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Маппинг названий стран на ISO коды для react-simple-maps
const countryNameToISO: Record<string, string> = {
  'Russia': 'RUS', 'United States': 'USA', 'China': 'CHN',
  'Germany': 'DEU', 'France': 'FRA', 'United Kingdom': 'GBR',
  'Ukraine': 'UKR', 'Turkey': 'TUR', 'India': 'IND',
  'Brazil': 'BRA', 'Japan': 'JPN', 'Iran': 'IRN',
  'Israel': 'ISR', 'Italy': 'ITA', 'Spain': 'ESP',
  'Poland': 'POL', 'Netherlands': 'NLD', 'Sweden': 'SWE',
  'Norway': 'NOR', 'Canada': 'CAN', 'Australia': 'AUS',
  'South Korea': 'KOR', 'Indonesia': 'IDN', 'Pakistan': 'PAK',
  'Egypt': 'EGY', 'South Africa': 'ZAF', 'Mexico': 'MEX',
  'Argentina': 'ARG', 'Kazakhstan': 'KAZ', 'Belarus': 'BLR'
};

// ISO код → координаты для маркеров событий
const countryCoords: Record<string, [number, number]> = {
  'Turkey': [35.2, 38.9], 'Japan': [138.2, 36.2], 'Italy': [12.5, 41.8],
  'France': [2.3, 46.2], 'Russia': [105.3, 61.5], 'USA': [-95.7, 37.1],
  'China': [104.1, 35.8], 'India': [78.9, 20.5], 'Brazil': [-51.9, -14.2],
  'Ukraine': [31.1, 48.3], 'Iran': [53.6, 32.4], 'Israel': [34.8, 31.0],
  'Germany': [10.4, 51.1], 'Spain': [-3.7, 40.4], 'Egypt': [30.8, 26.8]
};

type MapLayer = 'anxiety' | 'activity' | 'events';

export default function NoosphereMap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapData, setMapData] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('activity');
  const [tooltip, setTooltip] = useState<{text: string, x: number, y: number} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/map-data')
      .then(r => r.json())
      .then(data => { setMapData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const anxietyScale = scaleLinear<string>()
    .domain([0, 5, 10])
    .range(['#D1FAE5', '#FCD34D', '#DC2626']);

  const activityScale = scaleLinear<string>()
    .domain([0, 10, 50])
    .range(['#EFF6FF', '#93C5FD', '#1D4ED8']);

  const getCountryColor = (countryName: string) => {
    if (!mapData) return '#F3F4F6';
    
    if (activeLayer === 'anxiety') {
      const isoCode = countryNameToISO[countryName];
      const score = isoCode ? (mapData.anxietyMap[countryName] || 0) : 0;
      return score > 0 ? anxietyScale(score) : '#F3F4F6';
    }
    
    if (activeLayer === 'activity') {
      // Маппинг обратный — ищем по названию страны
      const activityCount = mapData.activityMap[countryName] || 0;
      return activityCount > 0 ? activityScale(activityCount) : '#F3F4F6';
    }
    
    return '#F3F4F6';
  };

  if (loading) return (
    <div className="h-96 flex items-center justify-center text-gray-400">
      Загрузка карты...
    </div>
  );

  return (
    <div className="relative">
      {/* Переключатель слоёв */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'anxiety', label: '🔮 Сигналы тревоги' },
          { id: 'activity', label: '📍 Активность' },
          { id: 'events', label: '🌍 События мира' }
        ].map(layer => (
          <button
            key={layer.id}
            onClick={() => setActiveLayer(layer.id as MapLayer)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              activeLayer === layer.id
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Легенда */}
      <div className="absolute top-12 right-4 z-10 bg-white/90 rounded-lg p-2 text-xs shadow">
        {activeLayer === 'anxiety' && (
          <div>
            <div className="font-medium mb-1">Интенсивность сигналов</div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{background:'#D1FAE5'}}/>
              <span>Низкая</span>
              <div className="w-3 h-3 rounded ml-2" style={{background:'#FCD34D'}}/>
              <span>Средняя</span>
              <div className="w-3 h-3 rounded ml-2" style={{background:'#DC2626'}}/>
              <span>Высокая</span>
            </div>
          </div>
        )}
        {activeLayer === 'activity' && (
          <div>
            <div className="font-medium mb-1">Записей за 48 часов</div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{background:'#EFF6FF'}}/>
              <span>1-10</span>
              <div className="w-3 h-3 rounded ml-2" style={{background:'#93C5FD'}}/>
              <span>10-50</span>
              <div className="w-3 h-3 rounded ml-2" style={{background:'#1D4ED8'}}/>
              <span>50+</span>
            </div>
          </div>
        )}
        {activeLayer === 'events' && (
          <div>
            <div className="font-medium mb-1">Мировые события</div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"/>
              <span>Высокий приоритет</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-3 h-3 rounded-full bg-yellow-400"/>
              <span>Средний приоритет</span>
            </div>
          </div>
        )}
      </div>

      {/* Карта */}
      <div className="border border-gray-100 rounded-xl overflow-hidden bg-blue-50/30">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [10, 20] }}
          height={400}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo: any) => {
                  const countryName = geo.properties.name;
                  const color = getCountryColor(countryName);
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none', transition: 'fill 0.3s' },
                        hover: { fill: '#10B981', outline: 'none', cursor: 'pointer' },
                        pressed: { outline: 'none' }
                      }}
                      onMouseEnter={(e: any) => {
                        const actCount = mapData?.activityMap[countryName] || 0;
                        const anxScore = mapData?.anxietyMap[countryName] || 0;
                        const text = activeLayer === 'activity'
                          ? `${countryName}: ${actCount} сигналов`
                          : activeLayer === 'anxiety' && anxScore > 0
                          ? `${countryName}: интенсивность ${anxScore.toFixed(1)}`
                          : countryName;
                        setTooltip({ text, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>

            {/* Маркеры событий — слой 3 */}
            {activeLayer === 'events' && mapData?.worldEvents?.map((event: any, i: number) => {
              const coords = countryCoords[event.geography];
              if (!coords) return null;
              return (
                <Marker key={i} coordinates={coords}>
                  <circle
                    r={event.severity === 'high' ? 6 : 4}
                    fill={event.severity === 'high' ? '#DC2626' : '#FCD34D'}
                    fillOpacity={0.8}
                    stroke="#fff"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e: any) => setTooltip({
                      text: event.title.slice(0, 60),
                      x: e.clientX,
                      y: e.clientY
                    })}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => window.open(event.url, '_blank')}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Статистика под картой */}
      {mapData && (
        <div className="mt-3 flex gap-4 text-sm text-gray-500">
          <span>
            📍 {Object.keys(mapData.activityMap).length} стран активны
          </span>
          <span>
            🌍 {mapData.worldEvents?.length || 0} событий сейчас
          </span>
          {Object.keys(mapData.anxietyMap).length > 0 && (
            <span>
              🔮 {Object.keys(mapData.anxietyMap).length} зон тревожности
            </span>
          )}
        </div>
      )}
    </div>
  );
}
