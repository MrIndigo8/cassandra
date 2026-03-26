import Anthropic from '@anthropic-ai/sdk';
import { VERIFY_MATCH_PROMPT } from '../claude/prompts';
import { NewsEvent } from '../news/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Тип для записи, который мы достаем из БД
export interface EntryData {
  id: string;
  created_at: string;
  content?: string;
  ai_images: string[] | null;
  ai_summary: string | null;
  ai_specificity: number | null;
  ai_scale: string | null;
  ai_geography: string | null;
  sensory_patterns?: Array<{ sensation: string; intensity: string; body_response: string }>;
  potential_event_types?: Array<{ event_type: string; confidence: number; reasoning?: string }>;
  collectivity?: { is_collective?: boolean; people_mentioned?: string; indicator?: string } | null;
  verification_keywords?: string[];
  anxiety_score?: number | null;
  geography_iso?: string | null;
}

export interface MatchScore {
  match_score: number;
  matched_elements: string[];
  explanation: string;
  confidence: number;
  sensory_match?: {
    matched_sensations: string[];
    event_nature: string;
    mapping_quality: 'exact' | 'strong' | 'moderate' | 'weak' | 'none';
  };
  collectivity_match?: {
    entry_collective: boolean;
    event_collective: boolean;
    match: boolean;
  };
  geography_match?: {
    entry_geography: string | null;
    event_geography: string | null;
    match_type: 'exact' | 'region' | 'none';
    match_detail: string;
  };
  temporal_match?: {
    entry_date: string;
    event_date: string;
    days_before_event: number;
    is_prediction: boolean;
  };
}

function eventLooksCollective(event: NewsEvent): boolean {
  const text = `${event.title} ${event.description || ''}`.toLowerCase();
  const collectiveHints = [
    'earthquake', 'tsunami', 'flood', 'war', 'attack', 'explosion', 'evacuation',
    'protest', 'riot', 'pandemic', 'outbreak', 'hurricane', 'wildfire',
  ];
  return collectiveHints.some((hint) => text.includes(hint));
}

export function quickRelevanceCheck(
  entry: { potential_event_types?: Array<{ event_type: string }>; verification_keywords?: string[]; anxiety_score?: number | null },
  event: { title: string; description?: string; category?: string }
): boolean {
  if (entry.anxiety_score !== null && entry.anxiety_score !== undefined && entry.anxiety_score < 3) {
    return false;
  }

  const eventText = `${event.title} ${event.description || ''}`.toLowerCase();
  if (entry.verification_keywords && entry.verification_keywords.length > 0) {
    const hasKeywordMatch = entry.verification_keywords.some((kw) => eventText.includes(String(kw).toLowerCase()));
    if (hasKeywordMatch) return true;
  }

  if (entry.potential_event_types && entry.potential_event_types.length > 0) {
    const entryTypes = entry.potential_event_types.map((t) => t.event_type);
    const categoryMapping: Record<string, string[]> = {
      earthquake: ['earthquake', 'tremor', 'seismic', 'magnitude'],
      flood: ['flood', 'flooding', 'deluge'],
      tsunami: ['tsunami', 'tidal wave'],
      war: ['war', 'conflict', 'military', 'troops', 'airstrike', 'bombing'],
      terror_attack: ['terror', 'attack', 'explosion', 'bomb'],
      fire: ['fire', 'wildfire', 'blaze', 'inferno'],
      epidemic: ['epidemic', 'pandemic', 'virus', 'outbreak', 'disease'],
      hurricane: ['hurricane', 'typhoon', 'cyclone', 'storm'],
      volcanic_eruption: ['volcano', 'eruption', 'lava'],
      plane_crash: ['plane crash', 'aircraft', 'aviation'],
      building_collapse: ['collapse', 'building collapse'],
      economic_crash: ['crash', 'recession', 'financial crisis', 'stock'],
    };
    for (const entryType of entryTypes) {
      const keywords = categoryMapping[entryType] || [];
      if (keywords.some((kw) => eventText.includes(kw))) return true;
    }
  }
  return false;
}

export function formatVerificationMessage(entry: EntryData, event: NewsEvent): string {
  let message = `## ЗАПИСЬ ПОЛЬЗОВАТЕЛЯ\n`;
  message += `Дата: ${entry.created_at}\n`;
  message += `Текст: "${entry.content || entry.ai_summary || ''}"\n`;

  if (entry.sensory_patterns && entry.sensory_patterns.length > 0) {
    message += `\nСенсорные паттерны (из AI-анализа):\n`;
    for (const p of entry.sensory_patterns) {
      message += `- ${p.sensation} (интенсивность: ${p.intensity}, реакция: ${p.body_response})\n`;
    }
  }

  if (entry.potential_event_types && entry.potential_event_types.length > 0) {
    message += `\nПотенциальные типы событий:\n`;
    for (const e of entry.potential_event_types) {
      message += `- ${e.event_type} (уверенность: ${e.confidence})\n`;
    }
  }

  if (entry.collectivity) {
    message += `\nКоллективность: ${entry.collectivity.is_collective ? 'да' : 'нет'} (${entry.collectivity.people_mentioned || 'none'})\n`;
  }

  message += `\n## РЕАЛЬНОЕ СОБЫТИЕ\n`;
  message += `Заголовок: ${event.title}\n`;
  if (event.description) message += `Описание: ${event.description}\n`;
  message += `Дата: ${event.publishedAt.toISOString()}\n`;
  if (event.geography) message += `География: ${event.geography}\n`;
  message += `\nОцени совпадение сенсорных паттернов записи с физической природой события. Ответь ТОЛЬКО JSON.`;
  return message;
}

/**
 * Оценивает совпадение записи с реальным новостным событием
 */
export async function scoreMatch(entry: EntryData, event: NewsEvent): Promise<MatchScore | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[Verification] ANTHROPIC_API_KEY не установлен');
    return null;
  }

  // Защита: Событие не должно быть ДО записи
  const entryDate = new Date(entry.created_at);
  if (event.publishedAt < entryDate) {
    return null;
  }

  if (!quickRelevanceCheck(entry, event)) {
    return null;
  }

  try {
    const prompt = formatVerificationMessage(entry, event);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      temperature: 0,
      system: VERIFY_MATCH_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content.find(block => block.type === 'text')?.text || '';
    
    // Пытаемся распарсить JSON
    const matchStart = responseText.indexOf('{');
    const matchEnd = responseText.lastIndexOf('}') + 1;
    
    if (matchStart === -1 || matchEnd <= matchStart) {
      console.error('[Verification] Claude не вернул JSON', responseText);
      return null;
    }

    const jsonText = responseText.slice(matchStart, matchEnd);
    const result = JSON.parse(jsonText) as Partial<MatchScore>;
    
    // Проверяем наличие нужных полей
    if (typeof result.match_score !== 'number' || !Array.isArray(result.matched_elements)) {
      return null;
    }

    const temporalMatch = result.temporal_match || {
      entry_date: entry.created_at,
      event_date: event.publishedAt.toISOString(),
      days_before_event: Math.floor((event.publishedAt.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)),
      is_prediction: true,
    };

    let adjustedScore = Math.max(0, Math.min(1, result.match_score));
    if (temporalMatch.days_before_event < 0) adjustedScore = Math.max(0, adjustedScore - 0.3);
    if ((entry.collectivity?.is_collective === false) && eventLooksCollective(event)) {
      adjustedScore = Math.max(0, adjustedScore - 0.15);
    }

    return {
      match_score: adjustedScore,
      matched_elements: result.matched_elements.slice(0, 8),
      explanation: typeof result.explanation === 'string' ? result.explanation : '',
      confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : adjustedScore,
      sensory_match: result.sensory_match,
      collectivity_match: result.collectivity_match,
      geography_match: result.geography_match,
      temporal_match: temporalMatch,
    };

  } catch (error) {
    console.error(`[Verification] Ошибка вызова Claude API для entry ${entry.id}:`, error);
    return null;
  }
}
