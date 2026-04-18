import type { Card } from './db';

export interface SentenceItem {
  zh: string;
  fr: string;
  tokens: string[];
}

interface SentencePayload {
  version: string;
  source: string;
  sentences: SentenceItem[];
}

let cache: SentenceItem[] | null = null;
let loadPromise: Promise<SentenceItem[]> | null = null;

const URL = `${import.meta.env.BASE_URL}sentences.json`;

export async function loadSentences(): Promise<SentenceItem[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`sentences.json → ${res.status}`);
    const data = (await res.json()) as SentencePayload;
    cache = data.sentences;
    return cache;
  })();
  return loadPromise;
}

export interface SentenceFilter {
  cards: Card[];
  minKnownRatio?: number;
  minTokens?: number;
  maxTokens?: number;
}

export function pickSentence(
  pool: SentenceItem[],
  filter: SentenceFilter
): SentenceItem | null {
  const known = new Set(filter.cards.map((c) => c.simplified));
  const minRatio = filter.minKnownRatio ?? 0.5;
  const minTokens = filter.minTokens ?? 4;
  const maxTokens = filter.maxTokens ?? 10;

  const eligible: SentenceItem[] = [];
  for (const s of pool) {
    if (s.tokens.length < minTokens || s.tokens.length > maxTokens) continue;
    const knownCount = s.tokens.filter((t) => known.has(t)).length;
    if (knownCount / s.tokens.length < minRatio) continue;
    eligible.push(s);
  }

  if (eligible.length === 0) {
    const lenientPool = pool.filter(
      (s) => s.tokens.length >= minTokens && s.tokens.length <= maxTokens
    );
    if (lenientPool.length === 0) return null;
    return lenientPool[Math.floor(Math.random() * lenientPool.length)];
  }

  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function shuffleTokens(tokens: string[]): string[] {
  const out = tokens.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((t, i) => t === tokens[i])) {
    return shuffleTokens(tokens);
  }
  return out;
}
