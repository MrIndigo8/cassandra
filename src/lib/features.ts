import { createAdminClient } from '@/lib/supabase/server';

let featuresCache: { data: Record<string, boolean>; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  if (featuresCache && Date.now() - featuresCache.timestamp < CACHE_TTL) {
    return featuresCache.data;
  }

  const supabase = createAdminClient();
  const { data } = await supabase.from('system_settings').select('key, value').like('key', 'features.%');

  const flags: Record<string, boolean> = {};
  for (const row of data || []) {
    const name = String(row.key).replace('features.', '');
    flags[name] = Boolean((row.value as { enabled?: boolean } | null)?.enabled ?? true);
  }

  featuresCache = { data: flags, timestamp: Date.now() };
  return flags;
}

export async function isFeatureEnabled(feature: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[feature] ?? true;
}
