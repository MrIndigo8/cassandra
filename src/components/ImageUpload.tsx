/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  onUpload: (url: string) => void;
  onRemove: () => void;
  currentUrl: string | null;
}

export default function ImageUpload({ onUpload, onRemove, currentUrl }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 5MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('entry-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('entry-images')
        .getPublicUrl(fileName);

      onUpload(publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка загрузки. Попробуйте ещё раз.');
    }
    setUploading(false);
  };

  return (
    <div>
      {currentUrl ? (
        <div className="relative mt-2">
          <img
            src={currentUrl}
            alt="Прикреплённое изображение"
            className="max-h-48 rounded-xl object-cover border border-gray-100"
          />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full text-xs hover:bg-black/70 transition-all"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 mt-1"
        >
          {uploading ? '⏳ Загрузка...' : '📎 Прикрепить фото'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
