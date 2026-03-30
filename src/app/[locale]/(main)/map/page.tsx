import dynamic from 'next/dynamic';
import { isFeatureEnabled } from '@/lib/features';
import { FeatureDisabled } from '@/components/FeatureDisabled';

export const revalidate = 0;

const NoosphereClient = dynamic(() => import('../noosphere/NoosphereClient'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-text-secondary">Загрузка карты...</div>
    </div>
  ),
  ssr: false,
});

export default async function MapPage() {
  if (!(await isFeatureEnabled('map'))) {
    return <FeatureDisabled navKey="map" />;
  }
  return <NoosphereClient />;
}
