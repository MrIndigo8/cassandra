export interface ExternalSignal {
  id: string;
  source: 'reddit' | 'polymarket' | 'rss';
  title: string;
  content: string;
  url: string;
  geography: string | null;
  publishedAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface MarketSignal {
  id: string;
  question: string;
  probability: number;
  category: string;
  endDate: string;
  volume: number;
}
