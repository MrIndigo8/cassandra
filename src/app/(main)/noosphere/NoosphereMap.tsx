'use client';

import React, { memo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Градиент от светло-зелёного до красного
const colorScale = scaleLinear<string>()
  .domain([0, 10]) // intensity_score: 0-10
  .range(["#86EFAC", "#DC2626"]);

interface MapData {
  countryName: string;
  intensity: number;
  topImages: string[];
}

interface NoosphereMapProps {
  data: Record<string, MapData>;
}

const NoosphereMap = ({ data }: NoosphereMapProps) => {
  // Проверяем, есть ли вообще данные
  const hasData = Object.keys(data).length > 0;

  return (
    <div className="w-full relative bg-surface border border-gray-100 rounded-xl overflow-hidden aspect-[2/1] min-h-[300px]">
      <ComposableMap
        projectionConfig={{ scale: 140 }}
        className="w-full h-full"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              // Ищем название страны в словаре (для простоты матчим по имени из GeoJSON)
              // В реальном мире лучше использовать ISO-коды (geo.id)
              const countryName = geo.properties.name;
              
              // Пытаемся найти данные для этой страны. Это простая эвристика.
              const countryData = Object.values(data).find(
                d => d.countryName.toLowerCase() === countryName.toLowerCase() || 
                     d.countryName.includes(countryName)
              );

              const fill = countryData 
                ? colorScale(Math.min(10, countryData.intensity)) 
                : "#E5E7EB"; // Светло-серый по дефолту

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#FFFFFF"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.8 },
                    pressed: { outline: "none" },
                  }}
                >
                  <title>{countryData ? `${countryName}: Интенсивность ${countryData.intensity.toFixed(1)}${countryData.topImages.length ? `\nОбразы: ${countryData.topImages.join(', ')}` : ''}` : countryName}</title>
                </Geography>
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-sm text-sm text-gray-500 font-medium border border-gray-100">
            Карта оживёт по мере накопления сигналов
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(NoosphereMap);
