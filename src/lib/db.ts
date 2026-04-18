import Dexie, { type Table } from 'dexie';

export interface DictEntry {
  id?: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  pinyinPlain: string;
  definitions: string[];
}

export interface Sentence {
  id: string;
  zh: string;
  fr?: string;
  source?: string;
  createdAt: number;
}

export interface Card {
  id: string;
  simplified: string;
  pinyin: string;
  definitions: string[];
  sentences: Sentence[];
  tags: string[];
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  last_review: number | null;
  createdAt: number;
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  rating: 1 | 2 | 3 | 4;
  reviewedAt: number;
  elapsed_days: number;
  stability: number;
  difficulty: number;
  wasNew: boolean;
}

export interface Meta {
  key: string;
  value: string | number | boolean;
}

class ChineseDB extends Dexie {
  dict!: Table<DictEntry, number>;
  cards!: Table<Card, string>;
  reviews!: Table<ReviewLog, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('chinese-pwa');
    this.version(1).stores({
      dict: '++id, simplified, pinyinPlain',
      cards: 'id, simplified, due, state, createdAt',
      reviews: '++id, cardId, reviewedAt',
      meta: 'key',
    });
    this.version(2)
      .stores({
        dict: '++id, simplified, pinyinPlain',
        cards: 'id, simplified, due, state, createdAt, *tags',
        reviews: '++id, cardId, reviewedAt',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('cards')
          .toCollection()
          .modify((card) => {
            if (!Array.isArray(card.tags)) card.tags = [];
          });
      });
  }
}

export const db = new ChineseDB();

export async function getMeta<T extends Meta['value']>(key: string): Promise<T | null> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : null;
}

export async function setMeta(key: string, value: Meta['value']): Promise<void> {
  await db.meta.put({ key, value });
}

export const DEFAULT_NEW_CARDS_PER_DAY = 8;

export async function getNewCardsPerDay(): Promise<number> {
  const v = await getMeta<number>('settings:newCardsPerDay');
  return typeof v === 'number' && v > 0 ? v : DEFAULT_NEW_CARDS_PER_DAY;
}

export async function setNewCardsPerDay(n: number): Promise<void> {
  await setMeta('settings:newCardsPerDay', Math.max(0, Math.floor(n)));
}
