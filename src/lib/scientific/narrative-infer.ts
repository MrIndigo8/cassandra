/**
 * Выводит доминирующий нарративный режим для агрегатов (в БД narrative_structure — часто текст summary).
 */
export function inferBeliefNarrative(summary: string | null, threatType: string | null): string {
  const t = `${summary || ''} ${threatType || ''}`.toLowerCase();

  const rules: Array<{ test: (s: string) => boolean; mode: string }> = [
    {
      test: (s) =>
        /(war|attack|terror|conflict|борьб|войн|противостояни|борьба|насили|violence)/.test(s),
      mode: 'conflict',
    },
    { test: (s) => /(run|escape|flee|бегств|избега|побег|угроз|chase|погон)/.test(s), mode: 'chase' },
    {
      test: (s) =>
        /(transform|перемен|переход|обновлен|rebirth|метаморф|threshold)/.test(s),
      mode: 'transformation',
    },
    { test: (s) => /(loss|потеря|утрат|grief|скорб)/.test(s), mode: 'loss' },
    { test: (s) => /(destruct|разруш|руин|collapse|хаос|chaos)/.test(s), mode: 'destruction' },
    { test: (s) => /(discover|открыти|новизн|исслед)/.test(s), mode: 'discovery' },
    { test: (s) => /(creat|созда|творч|build|стро)/.test(s), mode: 'creation' },
    { test: (s) => /(quest|поиск|цель|смысл|purpose|seek)/.test(s), mode: 'quest' },
    { test: (s) => /(observ|наблюд|отстран|witness)/.test(s), mode: 'observation' },
    { test: (s) => /(reflect|осмысл|размышл|insight)/.test(s), mode: 'reflection' },
    { test: (s) => /(reunion|воссоедин|связь|together)/.test(s), mode: 'reunion' },
  ];

  for (const { test, mode } of rules) {
    if (test(t)) return mode;
  }

  if (threatType === 'conflict') return 'conflict';
  if (threatType === 'disaster') return 'destruction';
  if (threatType === 'economic') return 'loss';
  if (threatType === 'health') return 'chase';
  if (threatType === 'social') return 'conflict';

  return 'fragmented';
}
