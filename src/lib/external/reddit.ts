import { ExternalSignal } from './types';

export async function fetchDreamSubreddits(): Promise<ExternalSignal[]> {
  const subreddits = ['Dreams', 'Precognition', 'Paranormal', 'Jung'];
  const signals: ExternalSignal[] = [];

  for (const sub of subreddits) {
    try {
      const response = await fetch(
        `https://www.reddit.com/r/${sub}/new.json?limit=25`,
        { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          },
          cache: 'no-store' // Отключаем кэш, чтобы Next.js не сохранял пустые ответы
        }
      );
      if (!response.ok) continue;
      
      const data = await response.json();
      const posts = data?.data?.children || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      posts.forEach((post: any) => {
        const p = post.data;
        if (p.selftext && p.selftext.length > 100) {
          signals.push({
            id: p.id,
            source: 'reddit',
            title: p.title,
            content: p.selftext.slice(0, 600),
            url: `https://reddit.com${p.permalink}`,
            geography: null,
            publishedAt: new Date(p.created_utc * 1000),
            metadata: {
              subreddit: sub,
              upvotes: p.score,
              comments: p.num_comments,
              author: p.author
            }
          });
        }
      });

      // Задержка между запросами чтобы не банили
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[Reddit] Ошибка для r/${sub}:`, e);
    }
  }

  console.log(`[Reddit] Получено ${signals.length} постов`);
  return signals;
}
