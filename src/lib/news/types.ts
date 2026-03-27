export interface NewsEvent {
  id: string;
  source: 'gdelt' | 'newsapi' | 'usgs' | 'guardian';
  title: string;
  description: string;
  url: string;
  publishedAt: Date;
  category: string;
  geography: string | null;
  severity: 'low' | 'medium' | 'high';
}

export interface NewsAudienceProfile {
  locale?: 'ru' | 'en';
  preferredCountries?: string[];
  preferredRegions?: string[];
  preferredTopics?: string[];
}
