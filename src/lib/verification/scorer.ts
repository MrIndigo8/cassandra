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
  ai_images: string[] | null;
  ai_summary: string | null;
  ai_specificity: number | null;
  direction: string | null;
  timeframe: string | null;
  quality: string | null;
}

export interface MatchScore {
  match_score: number;
  matched_elements: string[];
  explanation: string;
  confidence: number;
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
    // Не считаем совпадением, если событие произошло до записи
    return null;
  }

  try {
    const prompt = VERIFY_MATCH_PROMPT
      .replace('{entry_date}', entry.created_at)
      .replace('{ai_images}', (entry.ai_images || []).join(', '))
      .replace('{ai_summary}', entry.ai_summary || '')
      .replace('{ai_specificity}', String(entry.ai_specificity || 0))
      .replace('{direction}', entry.direction || 'не указано')
      .replace('{timeframe}', entry.timeframe || 'не указано')
      .replace('{quality}', entry.quality || 'не указано')
      .replace('{event_date}', event.publishedAt.toISOString())
      .replace('{event_title}', event.title)
      .replace('{event_description}', event.description)
      .replace('{event_category}', event.category);

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      temperature: 0, // Нам нужна максимальная четкость и логика
      system: "You are an analytical JSON API. Return ONLY valid JSON.",
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
    const result = JSON.parse(jsonText) as MatchScore;
    
    // Проверяем наличие нужных полей
    if (typeof result.match_score !== 'number' || !Array.isArray(result.matched_elements)) {
      return null;
    }

    return result;

  } catch (error) {
    console.error(`[Verification] Ошибка вызова Claude API для entry ${entry.id}:`, error);
    return null;
  }
}
