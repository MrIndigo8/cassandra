import Anthropic from '@anthropic-ai/sdk';
import { ANALYZE_ENTRY_PROMPT } from './prompts';
import { parseClaudeResponse, ClaudeAnalysisResult } from './parser';

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
 */
export async function analyzeEntry(content: string, type: string): Promise<ClaudeAnalysisResult | null> {
  if (!anthropic) {
    console.error('Ошибка: не задан ключ ANTHROPIC_API_KEY');
    return null;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      temperature: 0.3, // Низкая температура для более структурированного JSON ответа
      system: ANALYZE_ENTRY_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Пожалуйста, проанализируй следующий текст (Тип: ${type}):\n\n"${content}"`,
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
