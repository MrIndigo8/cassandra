import { redirect } from '@/navigation';
import { getLocale } from 'next-intl/server';

export default async function EventsPage() {
  const locale = await getLocale();
  redirect({ href: '/discoveries', locale });
}
