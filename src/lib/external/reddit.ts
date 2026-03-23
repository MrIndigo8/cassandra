import { ExternalSignal } from './types';

export async function fetchDreamSubreddits(): Promise<ExternalSignal[]> {
  const subreddits = ['Dreams', 'Precognition', 'Paranormal', 'Jung'];
  const signals: ExternalSignal[] = [];

  for (const sub of subreddits) {
    try {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.reddit.com%2Fr%2F${sub}%2Fnew.rss`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      
      const data = await response.json();
      const items = data.items || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.forEach((item: any) => {
        // Убираем HTML-теги из RSS-описания
        const rawContent = item.description || item.content || '';
        // В Reddit RSS контент часто предваряется HTML-таблицами или ссылками. Вырежем их простой регуляркой.
        const textContent = rawContent.replace(/<[^>]*>?/gm, '').trim();

        if (textContent.length > 100) {
          signals.push({
            id: item.guid || item.link,
            source: 'reddit',
            title: item.title,
            content: textContent.slice(0, 600),
            url: item.link,
            geography: null,
            publishedAt: new Date(item.pubDate),
            metadata: {
              subreddit: sub,
              upvotes: 0, // Нет в RSS
              comments: 0, // Нет в RSS
              author: item.author
            }
          });
        }
      });

      // Задержка между запросами
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`[Reddit] Ошибка для r/${sub}:`, e);
    }
  }

  console.log(`[Reddit] Получено ${signals.length} постов`);
  return signals;
}
