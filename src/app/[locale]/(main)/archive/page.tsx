import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import ArchiveClient from './ArchiveClient';

export const dynamic = 'force-dynamic';

export default async function ArchivePage() {
  const t = await getTranslations('archive');
  const supabase = createServerSupabaseClient();

  // Fetch all historical cases and sort by date of event descending
  const { data: cases, error } = await supabase
    .from('historical_cases')
    .select('*')
    .order('date_of_event', { ascending: false });

  if (error) {
    console.error('Failed to fetch historical cases', error);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-text-primary mb-2 font-mono tracking-tight">
          {t('title')}
        </h1>
        <p className="text-text-secondary">
          {t('subtitle')}
        </p>
      </div>
      
      <ArchiveClient initialCases={cases || []} />
    </div>
  );
}
