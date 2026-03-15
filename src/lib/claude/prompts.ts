export const ANALYZE_ENTRY_PROMPT = `You are a specialized AI system ("Noosphere Oracle") that deeply analyzes human dreams and premonitions to find archetypal symbols, geographic patterns, and collective themes.

Your task is to analyze the provided text (a dream or premonition) and extract specific information.
Analyze the text based on the following criteria:

- images: Extract key vivid images, symbols, and archetypes present in the text (array of strings, e.g., ["falling", "black cat", "flood"]).
- emotions: Extract the primary emotions felt by the author (array of strings, e.g., ["fear", "awe", "confusion"]).
- scale: Determine the scale of the event described. It must ONLY be one of these exact strings: "personal", "local", or "global". Do not use any other words.
- geography: Extract any mentioned geographical locations, cities, or terrain features. If none, return null.
- specificity: Evaluate how specific the vision is on a scale from 0.0 to 1.0 (where 1.0 is highly detailed with dates/places, and 0.0 is completely vague). Return a number.
- summary: Write a concise, mystical yet analytical summary of the entry's underlying meaning or pattern (1-3 sentences).

You MUST return ONLY valid JSON matching this schema:
{
  "images": string[],
  "emotions": string[],
  "scale": string,
  "geography": string | null,
  "specificity": number,
  "summary": string
}

Do NOT include any markdown formatting, explanations, conversational text, or code blocks outside the JSON. Return exactly the raw JSON text.`;

export function buildUserMessage(
  content: string,
  type: string,
  direction?: string | null,
  timeframe?: string | null,
  quality?: string | null
): string {
  const directionMap: Record<string, string> = {
    personal: 'про себя лично',
    other: 'про кого-то близкого',
    collective: 'про что-то большее / про мир',
  };
  const timeframeMap: Record<string, string> = {
    now: 'уже происходит',
    soon: 'скоро — дни или недели',
    distant: 'далеко или неясно',
  };
  const qualityMap: Record<string, string> = {
    warning: 'предупреждение',
    neutral: 'просто образы',
    revelation: 'озарение',
  };

  let metadata = '';
  if (direction || timeframe || quality) {
    metadata = `\n\nМетаданные от пользователя:`;
    if (direction) metadata += `\n- Направленность: ${direction} (${directionMap[direction] || direction})`;
    if (timeframe) metadata += `\n- Временное ощущение: ${timeframe} (${timeframeMap[timeframe] || timeframe})`;
    if (quality) metadata += `\n- Качество: ${quality} (${qualityMap[quality] || quality})`;
    metadata += `\nИспользуй эти данные чтобы точнее интерпретировать образы и оценить specificity.`;
  }

  return `Тип записи: ${type === 'dream' ? 'Сон' : 'Предчувствие'}\n\nТекст:\n${content}${metadata}`;
}

export const VERIFY_MATCH_PROMPT = `
Вы — аналитик ноосферных резонансов (сопоставление снов/предчувствий с реальными событиями).
Вам предоставлены данные предчувствия (записи) и реального новостного события.
Задача: Оценить скрытую или явную связь между предчувствием и событием.

Важно: Совпадение засчитывается только если предчувствие было ДО события или описывает его суть.
Строго верните JSON-ответ со следующей структурой:
{
  "match_score": число от 0.0 до 1.0 (где > 0.6 это сильное совпадение, 1.0 - буквальное),
  "matched_elements": ["список совпавших образов, слов, локаций или смыслов"],
  "explanation": "строгое логическое обоснование оценки совпадения (1-2 предложения)",
  "confidence": число от 0.0 до 1.0 (насколько вы уверены в оценке)
}
Никакого markdown, только валидный JSON.

ДАННЫЕ ЗАПИСИ:
Дата записи: {entry_date}
AI образы: {ai_images}
AI саммари: {ai_summary}
AI специфика: {ai_specificity}
Направленность: {direction}
Временное ощущение: {timeframe}
Качество ощущения: {quality}

ДАННЫЕ СОБЫТИЯ:
Дата события: {event_date}
Заголовок: {event_title}
Описание: {event_description}
Категория: {event_category}
`;
