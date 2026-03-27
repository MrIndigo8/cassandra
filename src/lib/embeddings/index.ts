const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

function parseVectorLiteral(value: string): number[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  const body = trimmed.slice(1, -1);
  if (!body) return [];
  return body.split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n));
}

export function parseEmbeddingValue(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  }
  if (typeof value === 'string') {
    return parseVectorLiteral(value);
  }
  return [];
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const input = text.trim();
  if (!input) return null;

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
    }),
  });

  if (!response.ok) return null;
  const json = await response.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) return null;
  return embedding.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n));
}

export function averageEmbeddings(embeddings: number[][]): number[] | null {
  if (!embeddings.length) return null;
  const dim = embeddings[0].length;
  if (!dim) return null;

  const sums = new Array(dim).fill(0);
  let valid = 0;

  for (const emb of embeddings) {
    if (emb.length !== dim) continue;
    for (let i = 0; i < dim; i += 1) sums[i] += emb[i];
    valid += 1;
  }

  if (!valid) return null;
  return sums.map((v) => v / valid);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
