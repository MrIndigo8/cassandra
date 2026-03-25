'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';

interface ProfileEditorProps {
  userId: string;
  currentDisplayName: string;
}

export function ProfileEditor({ userId, currentDisplayName }: ProfileEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', userId);

    setSaving(false);

    if (!error) {
      setIsEditing(false);
      router.refresh();
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="mt-2 text-xs text-primary hover:underline"
      >
        ✏️ Редактировать имя
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="Отображаемое имя"
        className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary w-40"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-3 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? '...' : 'Сохранить'}
      </button>
      <button
        onClick={() => { setIsEditing(false); setDisplayName(currentDisplayName); }}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900"
      >
        Отмена
      </button>
    </div>
  );
}
