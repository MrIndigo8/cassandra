import { redirect } from '@/navigation';
import { getLocale } from 'next-intl/server';

export default async function NoospherePage() {
  const locale = await getLocale();
  redirect({ href: '/map', locale });
}
