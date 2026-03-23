'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  users: { username: string; avatar_url: string | null };
}

interface Props {
  entryId: string;
  isAuthenticated: boolean;
  currentUsername?: string;
}

export default function EntryComments({ entryId, isAuthenticated, currentUsername }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    
    // Загрузить комментарии
    fetch(`/api/comments?entry_id=${entryId}`)
      .then(r => r.json())
      .then(data => setComments(data.data || []));

    // Realtime подписка
    const channel = supabase
      .channel(`comments:${entryId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `entry_id=eq.${entryId}`
      }, () => {
        // Загрузить новый комментарий с автором
        fetch(`/api/comments?entry_id=${entryId}`)
          .then(r => r.json())
          .then(data => setComments(data.data || []));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [entryId, isOpen, supabase]);

  const handleSubmit = async () => {
    if (!newComment.trim() || loading) return;
    setLoading(true);

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, content: newComment.trim() })
    });

    if (response.ok) {
      setNewComment('');
    }
    setLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    await fetch('/api/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId })
    });
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <div className="mt-2">
      {/* Кнопка показать комментарии */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        💬 {comments.length > 0 ? `${comments.length} комментариев` : 'Комментировать'}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* Список комментариев */}
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {comment.users?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-gray-900">
                    {comment.users?.username}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString('ru')}
                  </span>
                  {comment.users?.username === currentUsername && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-gray-300 hover:text-red-400 ml-auto"
                    >
                      удалить
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{comment.content}</p>
              </div>
            </div>
          ))}

          {/* Форма добавления */}
          {isAuthenticated ? (
            <div className="flex gap-2 mt-2">
              <textarea
                ref={inputRef}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Написать комментарий..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-green-400 min-h-[60px]"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!newComment.trim() || loading}
                className="px-3 py-2 bg-green-500 text-white rounded-xl text-sm hover:bg-green-600 disabled:opacity-50 self-end transition-all"
              >
                {loading ? '...' : '→'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              <a href="/login" className="text-green-500 hover:underline">Войдите</a> чтобы комментировать
            </p>
          )}
        </div>
      )}
    </div>
  );
}
