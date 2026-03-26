'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';

interface EntryLikeProps {
  entryId: string;
  initialCount: number;
  initialLiked: boolean;
}

export default function EntryLike({ entryId, initialCount, initialLiked }: EntryLikeProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [animating, setAnimating] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    setLiked(nextLiked);
    setCount(nextCount);
    setAnimating(true);
    window.setTimeout(() => setAnimating(false), 250);

    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId, emoji: 'like' }),
      });
      if (!res.ok) throw new Error('like_toggle_failed');
    } catch {
      // rollback on error
      setLiked(prevLiked);
      setCount(prevCount);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={liked}
      className={`flex items-center gap-1.5 p-1.5 rounded-lg transition-colors hover:bg-red-50 ${
        liked ? 'text-red-500' : 'text-gray-400'
      }`}
    >
      <Heart
        size={16}
        className={animating ? 'animate-like-pop' : ''}
        fill={liked ? 'currentColor' : 'none'}
      />
      <span className="text-sm">{count}</span>
    </button>
  );
}

