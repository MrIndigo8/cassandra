import { z } from 'zod';

// --- Entries ---
export const createEntrySchema = z.object({
  content: z.string()
    .min(30, 'Текст сигнала слишком короткий (минимум 30 символов)')
    .max(5000, 'Текст сигнала слишком длинный (максимум 5000 символов)'),
  is_public: z.boolean().optional().default(true),
  image_url: z.string().url('Некорректный URL изображения').optional().nullable(),
  scope: z.enum(['world', 'personal', 'unknown']).optional().default('unknown'),
});

// --- Reactions ---
export const reactionSchema = z.object({
  entry_id: z.string().uuid('Некорректный entry_id'),
  emoji: z.string().min(1).max(10, 'Слишком длинный эмодзи'),
});

// --- Comments ---
export const commentSchema = z.object({
  entry_id: z.string().uuid('Некорректный entry_id'),
  content: z.string()
    .min(1, 'Пустой комментарий')
    .max(500, 'Комментарий слишком длинный (максимум 500 символов)'),
});

export const deleteCommentSchema = z.object({
  id: z.string().uuid('Некорректный id комментария'),
});

// --- Self-report ---
export const selfReportSchema = z.object({
  entry_id: z.string().uuid('Некорректный entry_id'),
  status: z.enum(['fulfilled', 'partial', 'not_fulfilled', 'unsure'], {
    message: 'Недопустимый статус. Допустимые: fulfilled, partial, not_fulfilled, unsure',
  }),
  description: z.string().max(1000).optional(),
});
