import Anthropic from '@anthropic-ai/sdk';
import { UNIFIED_ANALYSIS_PROMPT, buildUserMessage } from './prompts';
import { parseClaudeResponse, ClaudeAnalysisResult } from './parser';
import { getModel } from './models';

// Инициализация клиента
// Если ключа нет (например, на этапе сборки), создаем заглушку, чтобы не падало
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

/**
 * Отправляет текст видения в Claude и возвращает структурированный анализ.
 *
 * @param content - Текст сновидения или предчувствия
 * @param type - Тип записи (dream или premonition) для лучшего контекста
 * @param direction - Направленность (personal/other/collective)
 * @param timeframe - Временное ощущение (now/soon/distant)
 * @param quality - Качество ощущения (warning/neutral/revelation)
 */
export async function analyzeEntry(
  content: string,
  type?: string | null,
  direction?: string | null,
  timeframe?: string | null,
  quality?: string | null
): Promise<ClaudeAnalysisResult | null> {
  if (!anthropic) {
    console.error('Ошибка: не задан ключ ANTHROPIC_API_KEY');
    return null;
  }

  try {
    const response = await anthropic.messages.create({
      model: getModel('analysis'),
      max_tokens: 1024,
      temperature: 0.3, // Низкая температура для более структурированного JSON ответа
      system: UNIFIED_ANALYSIS_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserMessage(content, type, direction, timeframe, quality),
        },
      ],
    });

    // Извлекаем текст из ответа Claude
    const responseText = response.content.find((block) => block.type === 'text')?.text;

    if (!responseText) {
      console.error('Claude вернул пустой текст или неожиданный формат', response);
      return null;
    }

    // Парсим результат
    return parseClaudeResponse(responseText);
  } catch (error) {
    console.error('Ошибка при обращении к Claude API:', error);
    return null;
  }
}
