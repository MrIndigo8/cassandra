// Допустимые значения type в БД (entries.type CHECK constraint)
const ALLOWED_ENTRY_TYPES = ['dream', 'premonition', 'unknown'] as const;

function sanitizeEntryType(type: string): string {
  return ALLOWED_ENTRY_TYPES.includes(type as typeof ALLOWED_ENTRY_TYPES[number])
    ? type
    : 'unknown';
}

export interface ClaudeAnalysisResult {
  images: string[];
  emotions: string[];
  scale: string;
  geography: string | null;
  type: string;
  specificity: number;
  timeframe_signal: string;
  summary: string;
}

export function parseClaudeResponse(text: string): ClaudeAnalysisResult {
  const fallback: ClaudeAnalysisResult = {
    images: [],
    emotions: [],
    scale: "unknown",
    geography: null,
    type: "unknown",
    specificity: 0,
    timeframe_signal: "near",
    summary: "Не удалось расшифровать сигнал."
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
      images: Array.isArray(parsed.images) ? parsed.images : fallback.images,
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions : fallback.emotions,
      scale: typeof parsed.scale === 'string' ? parsed.scale : fallback.scale,
      geography: typeof parsed.geography === 'string' ? parsed.geography : fallback.geography,
      type: sanitizeEntryType(typeof parsed.type === 'string' ? parsed.type : fallback.type),
      specificity: typeof parsed.specificity === 'number' ? parsed.specificity : fallback.specificity,
      timeframe_signal: typeof parsed.timeframe_signal === 'string' ? parsed.timeframe_signal : fallback.timeframe_signal,
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary
    };
  } catch (error) {
    console.error("Ошибка при парсинге ответа от Claude:", error, text);
    return fallback;
  }
}
