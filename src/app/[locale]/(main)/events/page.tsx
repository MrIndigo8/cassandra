import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchAllEvents } from '@/lib/news';
import { VerifyButton } from './VerifyButton';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'События | Кассандра',
  description: 'Верифицированные совпадения предсказаний с реальными событиями',
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateShort = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
};

/** Иконка источника события */
function SourceIcon({ source }: { source: string }) {
  const s = source?.toLowerCase() || '';
  if (s.includes('usgs') || s.includes('earthquake')) {
    return <span title="USGS — землетрясения" className="text-base">🌍</span>;
  }
  if (s.includes('relief') || s.includes('disaster')) {
    return <span title="ReliefWeb — катастрофы" className="text-base">🆘</span>;
  }
  if (s.includes('gdelt')) {
    return <span title="GDELT — глобальные события" className="text-base">📡</span>;
  }
  // default — NewsAPI
  return <span title={`Источник: ${source}`} className="text-base">📰</span>;
}

// Тип для совпадения с JOIN-данными
interface MatchRow {
  id: string;
  entry_id: string;
  event_title: string;
  event_description: string | null;
  event_source: string;
  event_url: string | null;
  event_date: string;
  event_location: string | null;
  similarity_score: number;
  matched_symbols: string[] | null;
  explanation: string | null;
  created_at: string;
  entries: {
    id: string;
    content: string;
    created_at: string;
    ai_images: string[] | null;
  } | null;
  users: {
    username: string;
    avatar_url: string | null;
  } | null;
}

// Группированное событие
interface GroupedEvent {
  event_title: string;
  event_description: string | null;
  event_source: string;
  event_url: string | null;
  event_date: string;
  event_location: string | null;
  matches: MatchRow[];
  top_score: number;
}

export default async function EventsPage() {
  const t = await getTranslations('events');
  const supabase = createServerSupabaseClient();

  // Запрос: matches с join на entries и users, score > 0.6
  const { data: rawMatches, error } = await supabase
    .from('matches')
    .select(`
      id,
      entry_id,
      event_title,
      event_description,
      event_source,
      event_url,
      event_date,
      event_location,
      similarity_score,
      matched_symbols,
      explanation,
      created_at,
      entries ( id, content, created_at, ai_images ),
      users:user_id ( username, avatar_url )
    `)
    .gt('similarity_score', 0.6)
    .order('similarity_score', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки совпадений:', error);
  }

  const matches = (rawMatches as MatchRow[] | null) || [];

  // Блок 2: Активные кластеры (сигналы без события)
  const { data: activeClusters } = await supabase
    .from('clusters')
    .select('*')
    .eq('is_resolved', false)
    .order('intensity_score', { ascending: false })
    .limit(5);

  const clusters = activeClusters || [];

  // Блок 3: Последние мировые события
  let worldEvents: { id: string; source: string; title: string; url: string; publishedAt: string; geography: string | null; severity: string }[] = [];
  try {
    const raw = await fetchAllEvents(2);
    worldEvents = raw.slice(0, 20).map(e => ({
      id: e.id,
      source: e.source,
      title: e.title,
      url: e.url,
      publishedAt: e.publishedAt.toISOString(),
      geography: e.geography,
      severity: e.severity,
    }));
  } catch (err) {
    console.error('Ошибка загрузки мировых событий:', err);
  }

  // Группируем по event_title
  const groupedMap = new Map<string, GroupedEvent>();

  for (const match of matches) {
    const key = match.event_title;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        event_title: match.event_title,
        event_description: match.event_description,
        event_source: match.event_source,
        event_url: match.event_url,
        event_date: match.event_date,
        event_location: match.event_location,
        matches: [],
        top_score: 0,
      });
    }
    const group = groupedMap.get(key)!;
    group.matches.push(match);
    if (match.similarity_score > group.top_score) {
      group.top_score = match.similarity_score;
    }
  }

  // Сортировка по top_score DESC
  const events = Array.from(groupedMap.values()).sort(
    (a, b) => b.top_score - a.top_score
  );

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-8">
      {/* Заголовок */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 font-mono tracking-tight">
          {t('title')}
        </h1>
        <p className="text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      {/* Счётчик */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-900 mb-1">{events.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">{t('eventsCount')}</div>
        </div>
        <div className="bg-surface border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
          <div className="text-3xl font-bold text-primary mb-1">{matches.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">{t('matchesCount')}</div>
        </div>
        <div className="bg-surface border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
          <div className="text-3xl font-bold text-green-600 mb-1">
            {matches.length > 0
              ? Math.round(
                  (matches.reduce((s, m) => s + m.similarity_score, 0) / matches.length) * 100
                )
              : 0}
            %
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">{t('averageAccuracy')}</div>
        </div>
      </div>

      {/* Блок 1: Верифицированные совпадения */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {t('verifiedMatches')}
        </h2>

        {events.length > 0 ? (
          <div className="space-y-6">
            {events.map((event) => (
              <div
                key={event.event_title}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
              >
                {/* Шапка события */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <SourceIcon source={event.event_source} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg leading-snug mb-1">
                        {event.event_url ? (
                          <a
                            href={event.event_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                          >
                            {event.event_title}
                          </a>
                        ) : (
                          event.event_title
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-mono">
                          {formatDate(event.event_date)}
                        </span>
                        {event.event_location && (
                          <span className="flex items-center gap-1">
                            📍 {event.event_location}
                          </span>
                        )}
                        <span className="text-gray-400">{event.event_source}</span>
                        <span
                          className={`ml-auto px-2 py-0.5 rounded-full font-bold ${
                            event.top_score > 0.8
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          Макс: {Math.round(event.top_score * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {event.event_description && (
                    <p className="mt-2 ml-8 text-sm text-gray-600 line-clamp-2">
                      {event.event_description}
                    </p>
                  )}
                </div>

                {/* Список записей-совпадений */}
                <div className="divide-y divide-gray-100">
                  {event.matches
                    .sort((a, b) => b.similarity_score - a.similarity_score)
                    .map((match) => {
                      const username = match.users?.username || 'аноним';
                      const initial = username[0].toUpperCase();
                      const entryDate = match.entries?.created_at || match.created_at;
                      const contentPreview = match.entries?.content
                        ? match.entries.content.length > 100
                          ? match.entries.content.slice(0, 100) + '…'
                          : match.entries.content
                        : '—';
                      const scorePercent = Math.round(match.similarity_score * 100);

                      return (
                        <div
                          key={match.id}
                          className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Аватар */}
                          <div
                            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium shrink-0 mt-0.5"
                            title={username}
                          >
                            {match.users?.avatar_url ? (
                              <Image
                                src={match.users.avatar_url}
                                alt={username}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              initial
                            )}
                          </div>

                          {/* Контент */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900">
                                {username}
                              </span>
                              <span className="text-xs text-gray-400 font-mono">
                                {formatDateShort(entryDate)}
                              </span>
                              {match.matched_symbols && match.matched_symbols.length > 0 && (
                                <div className="flex gap-1">
                                  {match.matched_symbols.slice(0, 3).map((sym, i) => (
                                    <span
                                      key={i}
                                      className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100"
                                    >
                                      #{sym}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                              {contentPreview}
                            </p>
                            {match.explanation && (
                              <p className="mt-1 text-xs text-gray-400 italic line-clamp-1">
                                {match.explanation}
                              </p>
                            )}
                          </div>

                          {/* Score */}
                          <div
                            className={`shrink-0 px-2.5 py-1 rounded-lg text-sm font-bold ${
                              scorePercent >= 80
                                ? 'bg-green-100 text-green-700'
                                : scorePercent >= 60
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {scorePercent}%
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center bg-gray-50 border border-gray-100 border-dashed rounded-xl text-gray-400 gap-2">
            <span className="text-3xl">🔮</span>
            <span className="text-sm italic">
              {t('noMatchesYet')}
            </span>
          </div>
        )}
      </div>

      {/* Блок 2: Активные сигналы */}
      <div className="mt-10">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          {t('activeSignals')}
        </h2>

        {clusters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clusters.map((cluster: Record<string, unknown>) => {
              const intensity = (cluster.intensity_score as number) || 0;
              let level = { text: t('levelLow'), color: 'bg-green-100 text-green-700 border-green-200' };
              if (intensity >= 3) level = { text: t('levelMedium'), color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
              if (intensity >= 6) level = { text: t('levelHigh'), color: 'bg-red-100 text-red-700 border-red-200' };

              return (
                <div
                  key={cluster.id as string}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
                >
                  {/* Заголовок + уровень */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${level.color}`}
                        >
                          {t('signalLabel')} {level.text} ({intensity.toFixed(1)})
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{cluster.title as string}</h3>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 whitespace-nowrap">
                      ⏳ {t('waiting')}
                    </span>
                  </div>

                  {/* Доминирующие образы */}
                  {Array.isArray(cluster.dominant_images) && cluster.dominant_images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {cluster.dominant_images.map((img: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded border border-gray-100"
                        >
                          #{img}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Метрики */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3 pb-3 border-b border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400">{t('records')}</span>
                      <span className="font-medium text-gray-900">{(cluster.entry_count as number) || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400">{t('users')}</span>
                      <span className="font-medium text-gray-900">{(cluster.unique_users as number) || 0}</span>
                    </div>
                    <div className="flex flex-col ml-auto">
                      <span className="text-[10px] uppercase font-bold text-gray-400">{t('status')}</span>
                      <span className="font-medium text-orange-600 text-xs">{t('pendingEvent')}</span>
                    </div>
                  </div>

                  {/* Прогноз ИИ */}
                  {typeof cluster.ai_prediction === 'string' && cluster.ai_prediction && (
                    <div className="bg-blue-50/50 rounded-lg p-3 text-sm border border-blue-100">
                      <span className="block text-xs font-bold text-blue-600 uppercase mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {t('aiPrediction')}
                      </span>
                      <p className="text-blue-900 italic leading-relaxed">{cluster.ai_prediction as string}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center bg-gray-50 border border-gray-100 border-dashed rounded-xl text-gray-400 gap-2">
            <span className="text-2xl">📡</span>
            <span className="text-sm italic">{t('noActiveSignals')}</span>
          </div>
        )}
      </div>

      {/* Блок 3: Последние мировые события */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {t('worldEvents')}
          </h2>
          <VerifyButton />
        </div>

        {worldEvents.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {worldEvents.map((event) => {
                const sourceIcon = event.source === 'usgs' ? '🌍' : event.source === 'gdelt' ? '📡' : '📰';
                const severityBadge = event.severity === 'high'
                  ? 'bg-red-50 text-red-600 border-red-100'
                  : event.severity === 'medium'
                  ? 'bg-yellow-50 text-yellow-600 border-yellow-100'
                  : 'bg-gray-50 text-gray-500 border-gray-100';

                return (
                  <div key={event.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                    <span className="text-base shrink-0">{sourceIcon}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 hover:text-primary transition-colors line-clamp-1"
                      >
                        {event.title}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">
                          {new Date(event.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {event.geography && (
                          <span className="text-xs text-gray-400">📍 {event.geography}</span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${severityBadge}`}>
                      {event.source}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center bg-gray-50 border border-gray-100 border-dashed rounded-xl text-gray-400 gap-2">
            <span className="text-2xl">📰</span>
            <span className="text-sm italic">{t('failedToLoadEvents')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
