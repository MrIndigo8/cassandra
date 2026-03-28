// Допустимые значения type в БД (миграции 010 + 025)
const ALLOWED_ENTRY_TYPES = [
  'dream',
  'premonition',
  'unknown',
  'feeling',
  'vision',
  'anxiety',
  'thought',
  'deja_vu',
  'sensation',
  'mood',
  'synchronicity',
] as const;

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
  threat_type: 'conflict' | 'disaster' | 'economic' | 'health' | 'social' | 'personal' | 'unknown' | null;
  temporal_urgency: 'imminent' | 'near_term' | 'distant' | 'unclear' | null;
  emotional_intensity: 'panic' | 'anxiety' | 'foreboding' | 'neutral' | null;
  sensory_data: {
    sensory_patterns: Array<{ sensation: string; intensity: string; body_response: string }>;
    potential_event_types: Array<{ event_type: string; confidence: number; reasoning: string }>;
    collectivity: { is_collective: boolean; people_mentioned: string; indicator: string };
    geography_clues: { explicit: string | null; implicit_clues: string[] };
    verification_keywords: string[];
  } | null;
  /** Короткий тёплый инсайт для пользователя (не медицинский совет). */
  user_insight: string | null;
  /** Вероятность «предсказательности» записи 0–1. */
  prediction_potential: number | null;
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
const VALID_EVENT_TYPES: Set<string> = new Set([
  'earthquake', 'tsunami', 'flood', 'fire', 'explosion', 'war', 'terror_attack', 'epidemic',
  'plane_crash', 'building_collapse', 'mass_panic', 'economic_crash', 'political_crisis',
  'volcanic_eruption', 'hurricane', 'other',
] as const);

function clampAnxietyScore(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function clampPredictionPotential(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function sanitizeUserInsight(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > 500 ? `${t.slice(0, 497)}…` : t;
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
    threat_type: null,
    temporal_urgency: null,
    emotional_intensity: null,
    sensory_data: null,
    user_insight: null,
    prediction_potential: null,
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

    const parsed = JSON.parse(cleanedText) as Record<string, unknown>;

    const temporality = (parsed.temporality && typeof parsed.temporality === 'object'
      ? parsed.temporality
      : {}) as Record<string, unknown>;
    const geography = (parsed.geography && typeof parsed.geography === 'object'
      ? parsed.geography
      : {}) as Record<string, unknown>;

    const sensoryPatterns = Array.isArray(parsed.sensory_patterns)
      ? parsed.sensory_patterns
          .filter((p): p is { sensation?: unknown; intensity?: unknown; body_response?: unknown } => typeof p === 'object' && p !== null)
          .map((p) => ({
            sensation: typeof p.sensation === 'string' ? p.sensation : '',
            intensity: typeof p.intensity === 'string' ? p.intensity : 'moderate',
            body_response: typeof p.body_response === 'string' ? p.body_response : '',
          }))
          .filter((p) => p.sensation.trim().length > 0)
          .slice(0, 10)
      : [];

    const potentialEventTypes = Array.isArray(parsed.potential_event_types)
      ? parsed.potential_event_types
          .filter((e): e is { event_type?: unknown; confidence?: unknown; reasoning?: unknown } => typeof e === 'object' && e !== null)
          .map((e) => ({
            event_type: typeof e.event_type === 'string' ? e.event_type : 'other',
            confidence: typeof e.confidence === 'number' ? Math.max(0, Math.min(1, e.confidence)) : 0,
            reasoning: typeof e.reasoning === 'string' ? e.reasoning : '',
          }))
          .filter((e) => VALID_EVENT_TYPES.has(e.event_type as string))
          .slice(0, 5)
      : [];

    const collectivityRaw = (parsed.collectivity && typeof parsed.collectivity === 'object'
      ? parsed.collectivity
      : {}) as Record<string, unknown>;
    const collectivity = {
      is_collective: Boolean(collectivityRaw.is_collective),
      people_mentioned: typeof collectivityRaw.people_mentioned === 'string' ? collectivityRaw.people_mentioned : 'none',
      indicator: typeof collectivityRaw.indicator === 'string' ? collectivityRaw.indicator : '',
    };

    const geographyClues = {
      explicit:
        typeof geography.explicit === 'string'
          ? geography.explicit
          : typeof parsed.geography === 'string'
            ? parsed.geography
            : null,
      implicit_clues: Array.isArray(geography.implicit_clues)
        ? geography.implicit_clues.filter((v): v is string => typeof v === 'string').slice(0, 10)
        : [],
    };

    const verificationKeywords = Array.isArray(parsed.verification_keywords)
      ? parsed.verification_keywords.filter((v): v is string => typeof v === 'string').slice(0, 15)
      : [];

    const sensory_data =
      sensoryPatterns.length > 0 || potentialEventTypes.length > 0 || verificationKeywords.length > 0
        ? {
            sensory_patterns: sensoryPatterns,
            potential_event_types: potentialEventTypes,
            collectivity,
            geography_clues: geographyClues,
            verification_keywords: verificationKeywords,
          }
        : null;

    return {
      title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
      images: verificationKeywords.length > 0 ? verificationKeywords : fallback.images,
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.filter((v): v is string => typeof v === 'string') : fallback.emotions,
      scale: typeof parsed.scale === 'string' ? parsed.scale : fallback.scale,
      geography:
        typeof geography.explicit === 'string'
          ? geography.explicit
          : typeof parsed.geography === 'string'
            ? parsed.geography
            : fallback.geography,
      geography_iso: sanitizeGeographyIso(geography.geography_iso ?? parsed.geography_iso),
      type: sanitizeEntryType(typeof parsed.type === 'string' ? parsed.type : fallback.type),
      specificity: typeof parsed.specificity === 'number' ? parsed.specificity : fallback.specificity,
      timeframe_signal:
        typeof temporality.temporal_urgency === 'string'
          ? temporality.temporal_urgency
          : typeof parsed.timeframe_signal === 'string'
            ? parsed.timeframe_signal
            : fallback.timeframe_signal,
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
      anxiety_score: clampAnxietyScore(parsed.anxiety_score),
      threat_type:
        typeof parsed.threat_type === 'string' && ALLOWED_THREAT_TYPES.has(parsed.threat_type as NonNullable<ClaudeAnalysisResult['threat_type']>)
          ? (parsed.threat_type as NonNullable<ClaudeAnalysisResult['threat_type']>)
          : null,
      temporal_urgency:
        typeof (temporality.temporal_urgency ?? parsed.temporal_urgency) === 'string' &&
        ALLOWED_TEMPORAL_URGENCY.has((temporality.temporal_urgency ?? parsed.temporal_urgency) as NonNullable<ClaudeAnalysisResult['temporal_urgency']>)
          ? ((temporality.temporal_urgency ?? parsed.temporal_urgency) as NonNullable<ClaudeAnalysisResult['temporal_urgency']>)
          : null,
      emotional_intensity:
        typeof parsed.emotional_intensity === 'string' && ALLOWED_EMOTIONAL_INTENSITY.has(parsed.emotional_intensity as NonNullable<ClaudeAnalysisResult['emotional_intensity']>)
          ? (parsed.emotional_intensity as NonNullable<ClaudeAnalysisResult['emotional_intensity']>)
          : null,
      sensory_data,
      user_insight: sanitizeUserInsight(parsed.user_insight),
      prediction_potential: clampPredictionPotential(parsed.prediction_potential),
    };
  } catch (error) {
    console.error("Ошибка при парсинге ответа от Claude:", error, text);
    return fallback;
  }
}
