'use client';
import { useState, useEffect } from 'react';

const EMOJIS = ['🔮','😨','✨','🌊','🔥','⚡','👁'];

interface Props {
  entryId: string;
  isAuthenticated: boolean;
}

export default function EntryReactions({ entryId, isAuthenticated }: Props) {
  const [reactions, setReactions] = useState<Record<string, { count: number; hasMyReaction: boolean }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/reactions?entry_id=${entryId}`)
      .then(r => r.json())
      .then(data => setReactions(data.data || {}));
  }, [entryId]);

  const handleReaction = async (emoji: string) => {
    if (!isAuthenticated || loading) return;
    setLoading(true);

    // Оптимистичное обновление
    setReactions(prev => ({
      ...prev,
      [emoji]: {
        count: prev[emoji]?.hasMyReaction 
          ? (prev[emoji]?.count || 1) - 1 
          : (prev[emoji]?.count || 0) + 1,
        hasMyReaction: !prev[emoji]?.hasMyReaction
      }
    }));

    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, emoji })
    });

    setLoading(false);
  };

  const activeEmojis = EMOJIS.filter(e => (reactions[e]?.count || 0) > 0);
  const inactiveEmojis = EMOJIS.filter(e => (reactions[e]?.count || 0) === 0);

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {/* Активные реакции */}
      {activeEmojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all ${
            reactions[emoji]?.hasMyReaction
              ? 'bg-green-100 border border-green-300 text-green-700'
              : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>{emoji}</span>
          <span className="text-xs font-medium">{reactions[emoji]?.count}</span>
        </button>
      ))}

      {/* Кнопка добавить реакцию */}
      {isAuthenticated && (
        <div className="relative group">
          <button className="flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-gray-50 border border-gray-200 text-gray-400 hover:bg-gray-100 transition-all">
            <span>+</span>
          </button>
          {/* Попап с неактивными реакциями */}
          <div className="absolute bottom-8 left-0 hidden group-hover:flex bg-white border border-gray-200 rounded-xl shadow-lg p-2 gap-1 z-10">
            {inactiveEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
