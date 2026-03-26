export const CLAUDE_MODELS = {
  analysis: 'claude-sonnet-4-20250514',
  utility: 'claude-haiku-4-5-20251001',
} as const;

export type ClaudeTask = keyof typeof CLAUDE_MODELS;

export function getModel(task: ClaudeTask): string {
  return CLAUDE_MODELS[task];
}
