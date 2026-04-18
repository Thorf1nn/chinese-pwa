import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  db,
  getNewCardsPerDay,
  setNewCardsPerDay,
  type Card,
  type DictEntry,
  type Sentence,
} from '../lib/db';
import { buildNewCard, reviewCard, type ReviewRating } from '../lib/fsrs';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const useDeckStore = defineStore('deck', () => {
  const cards = ref<Card[]>([]);
  const loaded = ref(false);
  const newCardsPerDay = ref(8);
  const newSeenToday = ref(0);

  async function loadAll() {
    cards.value = await db.cards.orderBy('createdAt').reverse().toArray();
    newCardsPerDay.value = await getNewCardsPerDay();
    newSeenToday.value = await db.reviews
      .where('reviewedAt')
      .aboveOrEqual(startOfToday())
      .filter((r) => r.wasNew === true)
      .count();
    loaded.value = true;
  }

  async function updateNewCardsPerDay(n: number) {
    await setNewCardsPerDay(n);
    newCardsPerDay.value = n;
  }

  async function addFromDictEntry(entry: DictEntry, tags: string[] = []): Promise<Card | null> {
    const existing = await db.cards.where('simplified').equals(entry.simplified).first();
    if (existing) {
      if (tags.length) {
        const merged = Array.from(new Set([...existing.tags, ...tags]));
        if (merged.length !== existing.tags.length) {
          existing.tags = merged;
          await db.cards.put({ ...existing });
          const idx = cards.value.findIndex((c) => c.id === existing.id);
          if (idx >= 0) cards.value[idx] = { ...existing };
        }
      }
      return existing;
    }
    const card = buildNewCard({
      id: uuid(),
      simplified: entry.simplified,
      pinyin: entry.pinyin,
      definitions: entry.definitions,
      tags,
    });
    await db.cards.put(card);
    cards.value.unshift(card);
    return card;
  }

  async function bulkImport(
    entries: Array<{ simplified: string; pinyin: string; definitions: string[] }>,
    tags: string[]
  ): Promise<{ added: number; alreadyPresent: number }> {
    let added = 0;
    let alreadyPresent = 0;
    const baseTime = Date.now();
    const newCards: Card[] = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const existing = await db.cards.where('simplified').equals(e.simplified).first();
      if (existing) {
        alreadyPresent++;
        const merged = Array.from(new Set([...existing.tags, ...tags]));
        if (merged.length !== existing.tags.length) {
          existing.tags = merged;
          await db.cards.put({ ...existing });
          const idx = cards.value.findIndex((c) => c.id === existing.id);
          if (idx >= 0) cards.value[idx] = { ...existing };
        }
        continue;
      }
      const card = buildNewCard({
        id: uuid(),
        simplified: e.simplified,
        pinyin: e.pinyin,
        definitions: e.definitions,
        tags,
      });
      card.createdAt = baseTime + i;
      card.due = baseTime + i;
      newCards.push(card);
      added++;
    }

    if (newCards.length) {
      await db.cards.bulkPut(newCards);
      cards.value = [...newCards.slice().reverse(), ...cards.value];
    }
    return { added, alreadyPresent };
  }

  async function removeCard(id: string) {
    await db.cards.delete(id);
    await db.reviews.where('cardId').equals(id).delete();
    cards.value = cards.value.filter((c) => c.id !== id);
  }

  async function addSentence(cardId: string, sentence: Omit<Sentence, 'id' | 'createdAt'>) {
    const card = cards.value.find((c) => c.id === cardId);
    if (!card) return;
    const s: Sentence = { id: uuid(), createdAt: Date.now(), ...sentence };
    card.sentences = [...card.sentences, s];
    await db.cards.put({ ...card });
  }

  async function removeSentence(cardId: string, sentenceId: string) {
    const card = cards.value.find((c) => c.id === cardId);
    if (!card) return;
    card.sentences = card.sentences.filter((s) => s.id !== sentenceId);
    await db.cards.put({ ...card });
  }

  async function submitReview(cardId: string, rating: ReviewRating) {
    const card = cards.value.find((c) => c.id === cardId);
    if (!card) return;
    const wasNew = card.state === 0;
    const { card: updated, log } = reviewCard(card, rating);
    Object.assign(card, updated);
    await db.cards.put({ ...updated });
    await db.reviews.add({ cardId, ...log, wasNew });
    if (wasNew) newSeenToday.value += 1;
  }

  function cardById(id: string) {
    return cards.value.find((c) => c.id === id) ?? null;
  }

  const now = ref(Date.now());
  setInterval(() => {
    now.value = Date.now();
  }, 30_000);

  const dueReviewCards = computed(() =>
    cards.value
      .filter((c) => c.state !== 0 && c.due <= now.value)
      .sort((a, b) => a.due - b.due)
  );

  const availableNewCards = computed(() =>
    cards.value
      .filter((c) => c.state === 0 && c.due <= now.value)
      .sort((a, b) => a.createdAt - b.createdAt)
  );

  const newLeftToday = computed(() =>
    Math.max(0, newCardsPerDay.value - newSeenToday.value)
  );

  const queuedNewCards = computed(() =>
    availableNewCards.value.slice(0, newLeftToday.value)
  );

  const dueCards = computed(() => [...dueReviewCards.value, ...queuedNewCards.value]);

  const newCount = computed(() => cards.value.filter((c) => c.state === 0).length);
  const totalCount = computed(() => cards.value.length);

  return {
    cards,
    loaded,
    newCardsPerDay,
    newSeenToday,
    newLeftToday,
    dueReviewCards,
    queuedNewCards,
    availableNewCards,
    dueCards,
    newCount,
    totalCount,
    loadAll,
    updateNewCardsPerDay,
    addFromDictEntry,
    bulkImport,
    removeCard,
    addSentence,
    removeSentence,
    submitReview,
    cardById,
  };
});
