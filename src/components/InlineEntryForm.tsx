'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useTranslations } from 'next-intl';
import ImageUpload from './ImageUpload';

export function InlineEntryForm() {
  const tFeed = useTranslations('feed');
  const tCommon = useTranslations('common');
  const tEntry = useTranslations('entry');
  const { profile } = useUser();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const minLength = 30;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isExpanded && 
        content.length === 0 && 
        !imageUrl && 
        formRef.current && 
        !formRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, content, imageUrl]);

  const handleSubmit = async () => {
    if (content.length < minLength) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Сохраняем запись в БД (post -> /api/entries)
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, image_url: imageUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tCommon('error'));
      }

      // Очищаем форму
      setContent('');
      setImageUrl(null);
      setIsExpanded(false);

      // Фоновый запуск анализа
      fetch('/api/analyze', { method: 'POST' }).catch(console.error);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(tCommon('error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={formRef} className="card glass p-4 mb-6 relative">
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden text-white font-medium">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>
              {profile?.username ? profile.username[0].toUpperCase() : '?'}
            </span>
          )}
        </div>
        
        <div className="flex-1">
          <label htmlFor="entry-content" className="sr-only">
            {tFeed('placeholder')}
          </label>
          <textarea
            id="entry-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder={tFeed('placeholder')}
            className={`w-full bg-transparent border-none focus:ring-0 text-text-primary placeholder:text-text-secondary/60 resize-none transition-all duration-300 ${
              isExpanded ? 'min-h-[120px]' : 'min-h-[40px]'
            }`}
            disabled={isSubmitting}
          />
          
          {error && (
            <div className="text-red-400 text-sm mt-2">{error}</div>
          )}

          {isExpanded && (
            <ImageUpload
              onUpload={(url) => setImageUrl(url)}
              onRemove={() => setImageUrl(null)}
              currentUrl={imageUrl}
            />
          )}

          {isExpanded && (
            <div className="flex items-center justify-between mt-4 border-t border-border pt-4">
              <span className={`text-xs ${content.length < minLength ? 'text-text-secondary' : 'text-primary'}`}>
                {content.length} / {minLength} {tEntry('minChars')}
              </span>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || content.length < minLength}
                  aria-label={tFeed('submit')}
                  className="px-6 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? tCommon('loading') : tFeed('submit')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
