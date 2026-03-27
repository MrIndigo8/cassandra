import NoosphereClient from '../noosphere/NoosphereClient';
import { isFeatureEnabled } from '@/lib/features';
import { FeatureDisabled } from '@/components/FeatureDisabled';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  if (!(await isFeatureEnabled('map'))) {
    return <FeatureDisabled name="Карта" />;
  }
  return <NoosphereClient />;
}
