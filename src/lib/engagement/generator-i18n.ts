/** Локализованные строки для engagement-генераторов (сервер, без next-intl). */

export type NotifLocale = 'ru' | 'en';

export function pick<T extends Record<'ru' | 'en', string>>(locale: NotifLocale, t: T): string {
  return t[locale] ?? t.ru;
}

export const deepInsightStrings = {
  noDeep: {
    ru: (snippet: string) =>
      `Ваша запись "${snippet}" проанализирована. Откройте запись, чтобы увидеть детали.`,
    en: (snippet: string) =>
      `Your entry "${snippet}" has been analyzed. Open the entry to see details.`,
  },
  arch: {
    Shadow: {
      ru: 'Ваше бессознательное обрабатывает скрытые стороны — это важный процесс интеграции.',
      en: 'Your unconscious is processing hidden sides — an important integration.',
    },
    Hero: {
      ru: 'Внутри вас активна энергия преодоления — вы готовитесь к важному шагу.',
      en: 'The energy of overcoming is active — you are preparing for an important step.',
    },
    Explorer: {
      ru: 'Ваша психика ищет новый опыт — впереди открытия.',
      en: 'Your psyche seeks new experience — discoveries ahead.',
    },
    Magician: {
      ru: 'Активен процесс внутренней трансформации — обратите внимание на перемены.',
      en: 'Inner transformation is active — notice the shifts.',
    },
    Destroyer: {
      ru: 'Что-то старое уходит — бессознательное освобождает место для нового.',
      en: 'Something old is leaving — the unconscious is making room for the new.',
    },
    Mother: {
      ru: 'Тема заботы и защиты активна — прислушайтесь к отношениям с близкими.',
      en: 'Care and protection are active — tune into close relationships.',
    },
    Trickster: {
      ru: 'Ваше бессознательное ломает шаблоны — возможно, пора взглянуть на ситуацию иначе.',
      en: 'Your unconscious breaks patterns — perhaps see the situation differently.',
    },
  },
  archFallback: {
    ru: (name: string) => `В вашей записи активен архетип "${name}".`,
    en: (name: string) => `Your entry activates the archetype "${name}".`,
  },
  narrativePrefix: { ru: 'Нарратив записи:', en: 'Entry narrative:' },
  highPotential: {
    ru: '🔮 Эта запись имеет высокий предчувственный потенциал. Мы продолжаем отслеживание совпадений.',
    en: '🔮 This entry has high premonition potential. We keep tracking possible matches.',
  },
  fallback: {
    ru: 'Ваша запись содержит ценный материал — система продолжает анализ.',
    en: 'Your entry holds valuable material — analysis continues.',
  },
} as const;

export const similarStrings = {
  users: { ru: 'пользователей', en: 'users' },
  fromCountries: { ru: 'из', en: 'from' },
  countries: { ru: 'стран', en: 'countries' },
  weekLine: {
    ru: 'за последнюю неделю сообщили о похожем переживании.',
    en: 'in the last week reported a similar experience.',
  },
  theme: { ru: 'Общая тема:', en: 'Common theme:' },
  openMap: {
    ru: '\n\nОткройте Карту, чтобы увидеть географию сигнала.',
    en: '\n\nOpen the Map to see the geography of the signal.',
  },
} as const;

export const trackingStrings = {
  match: {
    ru: (eventTitle: string, pct: number) =>
      `🔴 Обнаружено возможное совпадение.\n\n"${eventTitle}" — ${pct}%.\n\nОткройте запись, чтобы посмотреть детали.`,
    en: (eventTitle: string, pct: number) =>
      `🔴 A possible match was found.\n\n"${eventTitle}" — ${pct}%.\n\nOpen the entry for details.`,
  },
  observing: {
    ru: (title: string) => `Ваша запись "${title}..." остаётся под наблюдением.`,
    en: (title: string) => `Your entry "${title}..." remains under observation.`,
  },
  whatWeDo: { ru: '📡 Что делает система:', en: '📡 What the system does:' },
  bulletScan: { ru: '• Сканирует мировые события по расписанию', en: '• Scans world events on a schedule' },
  bulletIndicators: {
    ru: (n: number) => `• Отслеживает ${n} ключевых индикаторов`,
    en: (n: number) => `• Tracks ${n} key indicators`,
  },
  bulletHigh: { ru: '• Потенциал: ВЫСОКИЙ', en: '• Potential: HIGH' },
  notifyLine: {
    ru: 'Если совпадение будет найдено, вы получите уведомление сразу.',
    en: 'If a match is found, you will be notified immediately.',
  },
} as const;

export const report14Strings = {
  head: {
    ru: (dateStr: string, snippet: string) =>
      `📊 Отчёт по записи от ${dateStr}\n"${snippet}"\n\n`,
    en: (dateStr: string, snippet: string) =>
      `📊 Entry report for ${dateStr}\n"${snippet}"\n\n`,
  },
  match: {
    ru: (title: string, pct: number) =>
      `✅ Обнаружено совпадение: "${title}" (${pct}%).\nОткройте запись для подробностей.`,
    en: (title: string, pct: number) =>
      `✅ Match found: "${title}" (${pct}%).\nOpen the entry for details.`,
  },
  noMatch: {
    ru: '🔍 Совпадений пока не найдено.\nЭто не означает, что сигнал неверный: некоторые корреляции проявляются позже.',
    en: '🔍 No matches yet.\nThat does not mean the signal is wrong — some correlations appear later.',
  },
} as const;

export const selfReportStrings = {
  d7: {
    ru: (snippet: string) =>
      `Вы записали "${snippet}..." 7 дней назад. Сбылось ли что-то похожее?`,
    en: (snippet: string) =>
      `You wrote "${snippet}..." 7 days ago. Did anything similar happen?`,
  },
  d14: {
    ru: (snippet: string) =>
      `Прошло 14 дней с записи "${snippet}...". Совпало ли что-то в вашей жизни?`,
    en: (snippet: string) =>
      `14 days have passed since "${snippet}...". Did anything align in your life?`,
  },
} as const;

export const weeklyStrings = {
  title: {
    ru: (entries: number, matches: number) =>
      `🔮 Неделя: ${entries} записей${matches ? `, ${matches} совпадений` : ''}`,
    en: (entries: number, matches: number) =>
      `🔮 Your week: ${entries} entries${matches ? `, ${matches} matches` : ''}`,
  },
  header: { ru: '🔮 Ваша неделя в Кассандре', en: '🔮 Your week in Cassandra' },
  entries: { ru: (n: number) => `📝 Записей: ${n}`, en: (n: number) => `📝 Entries: ${n}` },
  streak: { ru: (n: number) => `🔥 Серия: ${n} дней`, en: (n: number) => `🔥 Streak: ${n} days` },
  rating: { ru: (n: string) => `⚡ Рейтинг: ${n}`, en: (n: string) => `⚡ Rating: ${n}` },
  yourMatches: { ru: '🎯 Ваши совпадения:', en: '🎯 Your matches:' },
  matchLine: {
    ru: (title: string, pct: number) => `• "${title}" — ${pct}%`,
    en: (title: string, pct: number) => `• "${title}" — ${pct}%`,
  },
  platform: {
    ru: (n: number) => `🌍 На платформе за неделю: ${n} совпадений`,
    en: (n: number) => `🌍 Platform matches this week: ${n}`,
  },
  profileProgress: {
    ru: (n: number) => `🧠 Символьный профиль: ${n}/10`,
    en: (n: number) => `🧠 Symbolic profile: ${n}/10`,
  },
  oracleProgress: {
    ru: (n: number) => `🔮 Персональный оракул: ${n}/20`,
    en: (n: number) => `🔮 Personal oracle: ${n}/20`,
  },
  cta: {
    ru: 'Что вы чувствуете прямо сейчас? Новая запись усиливает точность профиля.',
    en: 'What do you feel right now? A new entry improves profile accuracy.',
  },
} as const;
