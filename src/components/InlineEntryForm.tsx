'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useTranslations } from 'next-intl';
import { Mic, Square, X } from 'lucide-react';
import ImageUpload from './ImageUpload';

export function InlineEntryForm() {
  const tFeed = useTranslations('feed');
  const tCommon = useTranslations('common');
  const tEntry = useTranslations('entry');
  const tApi = useTranslations('api');
  const { profile } = useUser();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scope, setScope] = useState<'world' | 'personal' | 'unknown'>('unknown');
  const [isMobileComposerOpen, setIsMobileComposerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastInsight, setLastInsight] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!audioBlob.size) return;
        setIsTranscribing(true);
        setError(null);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'voice-note.webm');
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || tCommon('error'));
          setContent((prev) => `${prev}${prev ? ' ' : ''}${String(data.text || '').trim()}`);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : tCommon('error'));
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError(tCommon('error'));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (content.length < minLength) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setLastInsight(null);

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, image_url: imageUrl, scope }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as {
          errorCode?: string;
          error?: unknown;
        };
        if (
          res.status === 400 &&
          errorData.error &&
          typeof errorData.error === 'object' &&
          !Array.isArray(errorData.error)
        ) {
          throw new Error(tApi('entries.validation'));
        }
        const code = typeof errorData.errorCode === 'string' ? errorData.errorCode : 'internal';
        const byCode: Record<string, string> = {
          unauthorized: tApi('entries.unauthorized'),
          saveFailed: tApi('entries.saveFailed'),
          rateLimited: tApi('entries.rateLimited'),
          internal: tApi('entries.internal'),
        };
        throw new Error(byCode[code] ?? tApi('entries.internal'));
      }
      const payload = (await res.json()) as {
        data?: { id?: string };
        analysis?: { user_insight?: string | null };
      };

      setContent('');
      setImageUrl(null);
      setScope('unknown');
      setIsExpanded(false);
      setIsMobileComposerOpen(false);
      setSuccess(tFeed('submittedAnalyzing'));
      setLastInsight(
        typeof payload?.analysis?.user_insight === 'string' && payload.analysis.user_insight.trim()
          ? payload.analysis.user_insight.trim()
          : null
      );
      const createdEntryId = payload.data?.id;
      if (createdEntryId) {
        window.dispatchEvent(new CustomEvent('entry:created', { detail: { entryId: createdEntryId } }));
      }
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
    <>
      <div
        ref={formRef}
        className={`card glass p-4 mb-6 relative ${
          isMobileComposerOpen
            ? 'fixed inset-0 z-50 m-0 rounded-none overflow-y-auto'
            : 'hidden md:block'
        } md:static md:inset-auto md:z-auto md:m-0 md:rounded-2xl md:overflow-visible`}
      >
        {isMobileComposerOpen && (
          <div className="md:hidden flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-text-primary">{tFeed('newSignal')}</p>
            <button
              type="button"
              className="btn-ghost inline-flex items-center justify-center w-8 h-8"
              onClick={() => {
                setIsMobileComposerOpen(false);
                if (!content && !imageUrl) setIsExpanded(false);
              }}
              aria-label={tCommon('cancel')}
            >
              <X size={16} />
            </button>
          </div>
        )}

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
            className={`w-full bg-transparent border-none focus:ring-0 text-text-primary placeholder:text-text-muted resize-none transition-all duration-300 ${
              isExpanded ? 'min-h-[120px]' : 'min-h-[40px]'
            }`}
            disabled={isSubmitting}
          />

          {success && (
            <div className="text-green-400 text-sm mt-2">{success}</div>
          )}
          {lastInsight && (
            <div className="mt-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-text-secondary">
              <span className="text-xs font-semibold text-primary">{tEntry('userInsight')}</span>
              <p className="mt-1 text-text-primary">{lastInsight}</p>
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm mt-2">{error}</div>
          )}

          {isExpanded && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(['world', 'personal', 'unknown'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    scope === value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface text-text-secondary border-border hover:text-text-primary'
                  }`}
                >
                  {tFeed(`scope.${value}`)}
                </button>
              ))}
            </div>
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
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSubmitting || isTranscribing}
                  className="px-3 py-2 rounded-full border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 inline-flex items-center gap-2"
                  aria-label={isRecording ? tFeed('voice.stop') : tFeed('voice.start')}
                >
                  {isRecording ? <Square size={14} /> : <Mic size={14} />}
                  <span className="text-xs">
                    {isTranscribing ? tFeed('voice.transcribing') : isRecording ? tFeed('voice.stop') : tFeed('voice.start')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
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
    </>
  );
}
