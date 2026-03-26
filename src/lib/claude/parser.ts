// Допустимые значения type в БД (entries.type CHECK constraint — миграция 010)
const ALLOWED_ENTRY_TYPES = ['dream', 'premonition', 'unknown', 'feeling', 'vision'] as const;

function sanitizeEntryType(type: string): string {
  return ALLOWED_ENTRY_TYPES.includes(type as typeof ALLOWED_ENTRY_TYPES[number])
    ? type
    : 'unknown';
}

export interface ClaudeAnalysisResult {
  title: string;
  images: string[];
  emotions: string[];
  scale: string;
  geography: string | null;
  geography_iso: string | null;
  type: string;
  specificity: number;
  timeframe_signal: string;
  summary: string;
  anxiety_score: number | null;
  threat_type: 'conflict' | 'disaster' | 'economic' | 'health' | 'social' | 'personal' | 'unknown';
  temporal_urgency: 'imminent' | 'near_term' | 'distant' | 'unclear';
  emotional_intensity: 'panic' | 'anxiety' | 'foreboding' | 'neutral';
}

const ALLOWED_THREAT_TYPES = new Set([
  'conflict',
  'disaster',
  'economic',
  'health',
  'social',
  'personal',
  'unknown',
] as const);

const ALLOWED_TEMPORAL_URGENCY = new Set(['imminent', 'near_term', 'distant', 'unclear'] as const);
const ALLOWED_EMOTIONAL_INTENSITY = new Set(['panic', 'anxiety', 'foreboding', 'neutral'] as const);

function clampAnxietyScore(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function sanitizeGeographyIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function parseClaudeResponse(text: string): ClaudeAnalysisResult {
  const fallback: ClaudeAnalysisResult = {
    title: "Без названия",
    images: [],
    emotions: [],
    scale: "unknown",
    geography: null,
    geography_iso: null,
    type: "unknown",
    specificity: 0,
    timeframe_signal: "near",
    summary: "Не удалось расшифровать сигнал.",
    anxiety_score: null,
    threat_type: 'unknown',
    temporal_urgency: 'unclear',
    emotional_intensity: 'neutral',
  };

  if (!text) return fallback;

  try {
    // Иногда Claude может обернуть ответ в ```json ... ``` несмотря на инструкции
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json/, '');
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```/, '');
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.replace(/```$/, '');
    }
    
    // Пытаемся найти фигурные скобки, если есть лишний текст
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleanedText) as Partial<ClaudeAnalysisResult>;

    return {
      title: parsed.title || fallback.title,
      images: Array.isArray(parsed.images) ? parsed.images : fallback.images,
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions : fallback.emotions,
      scale: typeof parsed.scale === 'string' ? parsed.scale : fallback.scale,
      geography: typeof parsed.geography === 'string' ? parsed.geography : fallback.geography,
      geography_iso: sanitizeGeographyIso(parsed.geography_iso),
      type: sanitizeEntryType(typeof parsed.type === 'string' ? parsed.type : fallback.type),
      specificity: typeof parsed.specificity === 'number' ? parsed.specificity : fallback.specificity,
      timeframe_signal: typeof parsed.timeframe_signal === 'string' ? parsed.timeframe_signal : fallback.timeframe_signal,
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
      anxiety_score: clampAnxietyScore(parsed.anxiety_score),
      threat_type:
        typeof parsed.threat_type === 'string' && ALLOWED_THREAT_TYPES.has(parsed.threat_type as ClaudeAnalysisResult['threat_type'])
          ? (parsed.threat_type as ClaudeAnalysisResult['threat_type'])
          : fallback.threat_type,
      temporal_urgency:
        typeof parsed.temporal_urgency === 'string' && ALLOWED_TEMPORAL_URGENCY.has(parsed.temporal_urgency as ClaudeAnalysisResult['temporal_urgency'])
          ? (parsed.temporal_urgency as ClaudeAnalysisResult['temporal_urgency'])
          : fallback.temporal_urgency,
      emotional_intensity:
        typeof parsed.emotional_intensity === 'string' && ALLOWED_EMOTIONAL_INTENSITY.has(parsed.emotional_intensity as ClaudeAnalysisResult['emotional_intensity'])
          ? (parsed.emotional_intensity as ClaudeAnalysisResult['emotional_intensity'])
          : fallback.emotional_intensity,
    };
  } catch (error) {
    console.error("Ошибка при парсинге ответа от Claude:", error, text);
    return fallback;
  }
}
