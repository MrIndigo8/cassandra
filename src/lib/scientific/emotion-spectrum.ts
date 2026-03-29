/**
 * Приводит emotional_spectrum из deep_analysis к плоскому Record<string, number> (0–1)
 * для агрегатов и social-forecast. В БД часто: { emotions: string[], emotional_intensity, anxiety_score }.
 */
const EMOTION_ALIASES: Array<{ keys: string[]; canonical: string }> = [
  { keys: ['calm', 'спокой', 'calmness', 'peace'], canonical: 'calmness' },
  { keys: ['satisf', 'удовлетвор'], canonical: 'satisfaction' },
  { keys: ['anger', 'гнев', 'ярость'], canonical: 'anger' },
  { keys: ['anxiety', 'тревог', 'anxious'], canonical: 'anxiety' },
  { keys: ['fear', 'страх', 'ужас'], canonical: 'fear' },
  { keys: ['horror', 'кошмар'], canonical: 'horror' },
  { keys: ['disgust', 'отвращ'], canonical: 'disgust' },
  { keys: ['sad', 'печаль', 'грусть', 'sadness'], canonical: 'sadness' },
  { keys: ['nostalgia', 'ностальг'], canonical: 'nostalgia' },
  { keys: ['joy', 'радост'], canonical: 'joy' },
  { keys: ['interest', 'интерес'], canonical: 'interest' },
  { keys: ['excitement', 'возбужд', 'волнен'], canonical: 'excitement' },
  { keys: ['boredom', 'скук'], canonical: 'boredom' },
  { keys: ['relief', 'облегчен'], canonical: 'relief' },
  { keys: ['empath', 'сочувств'], canonical: 'empathic_pain' },
  { keys: ['awkward', 'неловк'], canonical: 'awkwardness' },
  { keys: ['craving', 'жажд', 'тягот'], canonical: 'craving' },
  { keys: ['hope', 'надежд'], canonical: 'hope' },
  { keys: ['shame', 'стыд'], canonical: 'shame' },
  { keys: ['guilt', 'вин'], canonical: 'guilt' },
];

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

function mapTokenToCanonical(token: string): string {
  const t = normalizeToken(token);
  for (const { keys, canonical } of EMOTION_ALIASES) {
    if (keys.some((k) => t.includes(k))) return canonical;
  }
  if (t.length > 1) return t.replace(/\s+/g, '_');
  return 'unknown';
}

export function flattenEmotionalSpectrum(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;

  const emotions = o.emotions;
  if (Array.isArray(emotions) && emotions.length > 0) {
    const w = 1 / emotions.length;
    for (const e of emotions) {
      const key = mapTokenToCanonical(String(e));
      if (key === 'unknown') continue;
      out[key] = (out[key] || 0) + w;
    }
  }

  for (const [k, v] of Object.entries(o)) {
    if (k === 'emotions' || k === 'emotional_intensity') continue;
    if (typeof v === 'number' && !Number.isNaN(v)) {
      const key = mapTokenToCanonical(k);
      out[key] = (out[key] || 0) + Math.max(0, Math.min(1, v));
    }
  }

  if (typeof o.anxiety_score === 'number' && !Number.isNaN(o.anxiety_score)) {
    const a = Math.max(0, Math.min(10, o.anxiety_score)) / 10;
    out.anxiety = Math.max(out.anxiety || 0, a);
  }

  return out;
}

export function mergeEmotionRecords(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] || 0) + v;
  }
  return out;
}

export function averageEmotionMaps(
  maps: Record<string, number>[],
  count: number
): Record<string, number> {
  if (count <= 0 || maps.length === 0) return {};
  const keys = new Set<string>();
  maps.forEach((m) => Object.keys(m).forEach((k) => keys.add(k)));
  const out: Record<string, number> = {};
  for (const k of Array.from(keys)) {
    const sum = maps.reduce((s, m) => s + (m[k] || 0), 0);
    out[k] = Math.round((sum / count) * 1000) / 1000;
  }
  return out;
}

export function centroidEmotionCoherence(maps: Record<string, number>[]): number {
  if (maps.length < 2) return 0.5;
  const dims = new Set<string>();
  maps.forEach((m) => Object.keys(m).forEach((k) => dims.add(k)));
  const mean: Record<string, number> = {};
  for (const d of Array.from(dims)) {
    mean[d] = maps.reduce((s, m) => s + (m[d] || 0), 0) / maps.length;
  }
  let simSum = 0;
  for (const m of maps) {
    simSum += cosineSimilarity(m, mean);
  }
  return Math.round((simSum / maps.length) * 1000) / 1000;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of Array.from(keys)) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}
