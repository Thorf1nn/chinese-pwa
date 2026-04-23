import { db, type Card, type DictEntry, type UserText } from './db';

const TEXTS_URL = `${import.meta.env.BASE_URL}texts.json`;

export interface PreloadText {
  id: string;
  title: string;
  subtitle?: string;
  hskLevel?: number;
  content: string;
  description?: string;
}

interface PreloadPayload {
  version: string;
  texts: PreloadText[];
}

let preloadCache: PreloadText[] | null = null;

export async function loadPreloadTexts(): Promise<PreloadText[]> {
  if (preloadCache) return preloadCache;
  try {
    const res = await fetch(TEXTS_URL);
    if (!res.ok) throw new Error(String(res.status));
    const payload = (await res.json()) as PreloadPayload;
    preloadCache = payload.texts;
    return payload.texts;
  } catch (err) {
    console.error('[reader] preload fetch failed', err);
    return [];
  }
}

const HAN = /[\u3400-\u9FFF\uF900-\uFAFF]/;

export interface ReaderToken {
  text: string;
  isChinese: boolean;
  entry: DictEntry | null;
}

export async function segmentText(text: string): Promise<ReaderToken[]> {
  const cleaned = text.replace(/\r\n/g, '\n');
  const out: ReaderToken[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (!HAN.test(ch)) {
      out.push({ text: ch, isChinese: false, entry: null });
      i++;
      continue;
    }
    let matched: DictEntry | null = null;
    let matchLen = 1;
    const maxLen = Math.min(6, cleaned.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const candidate = cleaned.substring(i, i + len);
      if (!HAN.test(candidate)) continue;
      let allHan = true;
      for (const c of candidate) {
        if (!HAN.test(c)) {
          allHan = false;
          break;
        }
      }
      if (!allHan) continue;
      const entry = await db.dict.where('simplified').equals(candidate).first();
      if (entry) {
        matched = entry;
        matchLen = len;
        break;
      }
    }
    out.push({
      text: cleaned.substring(i, i + matchLen),
      isChinese: true,
      entry: matched,
    });
    i += matchLen;
  }
  return out;
}

export type TokenStatus = 'mastered' | 'learning' | 'unknown' | 'nohit';

export function classifyToken(token: ReaderToken, cardsBySimplified: Map<string, Card>): TokenStatus {
  if (!token.isChinese) return 'nohit';
  if (!token.entry) return 'nohit';
  const card = cardsBySimplified.get(token.entry.simplified);
  if (!card) return 'unknown';
  if (card.state === 2 && card.stability > 7) return 'mastered';
  return 'learning';
}

export interface ReadStats {
  totalChineseTokens: number;
  uniqueWords: number;
  mastered: number;
  learning: number;
  unknown: number;
  masteredPct: number;
  learningPct: number;
  unknownPct: number;
}

export function computeReadStats(tokens: ReaderToken[], cards: Card[]): ReadStats {
  const bySimplified = new Map<string, Card>();
  for (const c of cards) bySimplified.set(c.simplified, c);

  const uniqueSeen = new Set<string>();
  let mastered = 0;
  let learning = 0;
  let unknown = 0;
  let totalChinese = 0;

  for (const t of tokens) {
    if (!t.isChinese || !t.entry) continue;
    totalChinese++;
    const key = t.entry.simplified;
    if (uniqueSeen.has(key)) continue;
    uniqueSeen.add(key);
    const status = classifyToken(t, bySimplified);
    if (status === 'mastered') mastered++;
    else if (status === 'learning') learning++;
    else if (status === 'unknown') unknown++;
  }

  const uniqueWords = uniqueSeen.size;
  const pct = (n: number) => (uniqueWords > 0 ? Math.round((n / uniqueWords) * 100) : 0);

  return {
    totalChineseTokens: totalChinese,
    uniqueWords,
    mastered,
    learning,
    unknown,
    masteredPct: pct(mastered),
    learningPct: pct(learning),
    unknownPct: pct(unknown),
  };
}

export async function saveUserText(text: Omit<UserText, 'createdAt'>): Promise<UserText> {
  const payload: UserText = {
    ...text,
    createdAt: Date.now(),
  };
  await db.userTexts.put(payload);
  return payload;
}

export async function updateLastRead(id: string): Promise<void> {
  const existing = await db.userTexts.get(id);
  if (!existing) return;
  existing.lastReadAt = Date.now();
  await db.userTexts.put(existing);
}

export async function deleteUserText(id: string): Promise<void> {
  await db.userTexts.delete(id);
}

export async function listUserTexts(): Promise<UserText[]> {
  return db.userTexts.orderBy('createdAt').reverse().toArray();
}
