import { db, type DictEntry } from './db';

const HAN = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const PINYIN_SYLLABLE = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(a|ai|an|ang|ao|e|ei|en|eng|er|i|ia|ian|iang|iao|ie|in|ing|iong|iu|o|ong|ou|u|ua|uai|uan|uang|ue|ui|un|uo|ve|v)?$/i;

export function normalizePinyin(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

function looksLikePinyin(query: string): boolean {
  const tokens = query.toLowerCase().trim().split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every((t) => {
    const clean = t.replace(/[1-5]$/, '');
    return PINYIN_SYLLABLE.test(clean) && clean.length > 0;
  });
}

export async function searchDictionary(query: string, limit = 30): Promise<DictEntry[]> {
  const q = query.trim();
  if (!q) return [];

  if (HAN.test(q)) {
    const starts = await db.dict.where('simplified').startsWith(q).limit(limit).toArray();
    if (starts.length >= limit) return starts;
    const contains: DictEntry[] = [];
    await db.dict
      .filter((e) => e.simplified.includes(q) && !e.simplified.startsWith(q))
      .until(() => starts.length + contains.length >= limit)
      .each((e) => {
        contains.push(e);
      });
    return [...starts, ...contains];
  }

  const lower = q.toLowerCase();
  const hasOnlyLatin = /^[a-zA-Z0-9\s'-]+$/.test(q);

  if (hasOnlyLatin && looksLikePinyin(q)) {
    const qPlain = normalizePinyin(q);
    const pinyinHits = await db.dict.where('pinyinPlain').startsWith(qPlain).limit(limit).toArray();
    if (pinyinHits.length > 0) return pinyinHits;
  }

  const results: DictEntry[] = [];
  await db.dict
    .filter((e) => e.definitions.some((d) => d.toLowerCase().includes(lower)))
    .until(() => results.length >= limit)
    .each((e) => {
      results.push(e);
    });

  results.sort((a, b) => {
    const aExact = a.definitions.some((d) => d.toLowerCase() === lower) ? 0 : 1;
    const bExact = b.definitions.some((d) => d.toLowerCase() === lower) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aStart = a.definitions.some((d) => d.toLowerCase().startsWith(lower)) ? 0 : 1;
    const bStart = b.definitions.some((d) => d.toLowerCase().startsWith(lower)) ? 0 : 1;
    return aStart - bStart;
  });

  return results;
}
