import { Metadata } from 'next';
import { Link } from '@/navigation';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EntryClient } from './EntryClient';
import type { Entry } from '@/types';

interface Props {
  params: { id: string };
}

// Расширенный тип, включающий автора
interface EntryWithUser extends Entry {
  users: {
    username: string;
    avatar_url: string | null;
  } | null;
}

// Загрузчик данных (для метаданных и страницы)
async function getEntry(id: string): Promise<EntryWithUser | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('entries')
    .select(`
      *,
      users:user_id (username, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as EntryWithUser;
}

// Генерация Open Graph тегов
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getEntry(params.id);

  if (!entry) {
    return {
      title: 'Сигнал не найден',
    };
  }

  // Очистка текста от переносов и обрезка до 100 символов
  const description = entry.content.replace(/\n/g, ' ').slice(0, 100) + '...';
  const username = entry.users?.username || 'Аноним';
  const dateStr = new Date(entry.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Формируем URL для генерации картинки
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const ogParams = new URLSearchParams({
    type: entry.type,
    title: entry.title,
    username: username,
    date: dateStr,
    intensity: entry.intensity?.toString() || '0'
  });
  const ogUrl = `${baseUrl}/api/og?${ogParams.toString()}`;

  return {
    title: entry.title,
    description: description,
    openGraph: {
      title: entry.title,
      description: description,
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: entry.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: entry.title,
      description: description,
      images: [ogUrl],
    },
  };
}

export default async function EntryPage({ params }: Props) {
  const entry = await getEntry(params.id);

  if (!entry) {
    return (
      <div className="max-w-[680px] mx-auto py-8 px-4">
        <Link href="/feed" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Вернуться в ленту
        </Link>
        <div className="border border-red-200 rounded-lg text-center py-12 px-6 bg-red-50">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Сигнал потерян</h2>
          <p className="text-gray-500">Запись не найдена, удалена или приватна.</p>
        </div>
      </div>
    );
  }

  return <EntryClient entry={entry} />;
}
