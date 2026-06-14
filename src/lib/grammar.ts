import type { Card } from './db';

export type GrammarLevel = 1 | 2 | 3 | 4 | 5;

export interface RawItem {
  id: string;
  type: 'vocab' | 'grammar' | 'fill-blank' | 'translate-fr';
  level: GrammarLevel;
  order: number;
  hanzi?: string;
  pinyin?: string;
  meaning?: string;
  grammarId?: string;
  grammarTitle?: string;
  grammarStructure?: string;
  grammarExplanation?: string;
  sentence?: string;
  translation?: string;
  words?: string[];
  sentenceIndex?: number;
  totalSentences?: number;
}

export interface GrammarItem {
  id: string;
  level: GrammarLevel;
  order: number;
  title: string;
  structure: string;
  explanation: string;
  sentence: string;
  pinyin: string;
  translation: string;
  wordHanzi: string[];
}

const LEVEL_FILES: Record<GrammarLevel, string> = {
  1: 'grammar-hsk1.json',
  2: 'grammar-hsk2.json',
  3: 'grammar-hsk3.json',
  4: 'grammar-hsk4.json',
  5: 'grammar-hsk5.json',
};

export const GRAMMAR_LEVELS: GrammarLevel[] = [1, 2, 3, 4, 5];

interface LoadedData {
  items: GrammarItem[];
  vocabHanziByLevel: Map<GrammarLevel, string[]>;
}

let cache: LoadedData | null = null;
let loadPromise: Promise<LoadedData> | null = null;

async function fetchLevel(level: GrammarLevel): Promise<RawItem[]> {
  const url = `${import.meta.env.BASE_URL}${LEVEL_FILES[level]}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${LEVEL_FILES[level]} → ${res.status}`);
  return (await res.json()) as RawItem[];
}

export async function loadGrammar(): Promise<LoadedData> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const perLevel = await Promise.all(GRAMMAR_LEVELS.map(fetchLevel));
    const allRaw = perLevel.flat();

    const wordIdToHanzi = new Map<string, string>();
    const vocabHanziByLevel = new Map<GrammarLevel, string[]>();
    for (const lvl of GRAMMAR_LEVELS) vocabHanziByLevel.set(lvl, []);

    for (const it of allRaw) {
      if (it.type === 'vocab' && it.hanzi) {
        wordIdToHanzi.set(it.id, it.hanzi);
        vocabHanziByLevel.get(it.level)?.push(it.hanzi);
      }
    }

    const items: GrammarItem[] = allRaw
      .filter((it) => it.type === 'grammar' && it.sentence)
      .map((it) => ({
        id: it.id,
        level: it.level,
        order: it.order,
        title: it.grammarTitle ?? '',
        structure: it.grammarStructure ?? '',
        explanation: it.grammarExplanation ?? '',
        sentence: it.sentence ?? '',
        pinyin: it.pinyin ?? '',
        translation: it.translation ?? '',
        wordHanzi: (it.words ?? [])
          .map((w) => wordIdToHanzi.get(w))
          .filter((h): h is string => Boolean(h)),
      }))
      .sort((a, b) => (a.level - b.level) || (a.order - b.order));

    cache = { items, vocabHanziByLevel };
    return cache;
  })();
  return loadPromise;
}

const MASTERY_MIN_STABILITY = 7;

function isMastered(card: Card): boolean {
  return card.state === 2 && card.stability > MASTERY_MIN_STABILITY;
}

function isKnown(card: Card): boolean {
  return card.state !== 0;
}

export function vocabMasteryForLevel(
  cards: Card[],
  vocabHanzi: string[]
): number {
  if (vocabHanzi.length === 0) return 1;
  const bySimplified = new Map(cards.map((c) => [c.simplified, c]));
  let mastered = 0;
  for (const hanzi of vocabHanzi) {
    const card = bySimplified.get(hanzi);
    if (card && isMastered(card)) mastered++;
  }
  return mastered / vocabHanzi.length;
}

const GRAMMAR_UNLOCK_MASTERY = 0.3;
const WORD_KNOWN_RATIO = 0.75;

export interface EligibilityContext {
  cards: Card[];
  vocabHanziByLevel: Map<GrammarLevel, string[]>;
}

export function isItemEligible(item: GrammarItem, ctx: EligibilityContext): boolean {
  const levelVocab = ctx.vocabHanziByLevel.get(item.level) ?? [];
  if (vocabMasteryForLevel(ctx.cards, levelVocab) < GRAMMAR_UNLOCK_MASTERY) {
    return false;
  }
  if (item.wordHanzi.length === 0) return true;
  const known = new Set(ctx.cards.filter(isKnown).map((c) => c.simplified));
  const knownCount = item.wordHanzi.filter((h) => known.has(h)).length;
  return knownCount / item.wordHanzi.length >= WORD_KNOWN_RATIO;
}
