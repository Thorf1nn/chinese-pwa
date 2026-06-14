import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { db, type GrammarProgress } from '../lib/db';
import {
  loadGrammar,
  isItemEligible,
  vocabMasteryForLevel,
  GRAMMAR_LEVELS,
  type GrammarItem,
  type GrammarLevel,
} from '../lib/grammar';
import { useDeckStore } from './deck';

const NEW_GRAMMAR_PER_DAY = 5;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const useGrammarStore = defineStore('grammar', () => {
  const items = ref<GrammarItem[]>([]);
  const vocabHanziByLevel = ref<Map<GrammarLevel, string[]>>(new Map());
  const progressByItem = ref<Map<string, GrammarProgress>>(new Map());
  const loaded = ref(false);
  const newSeenToday = ref(0);
  const now = ref(Date.now());

  async function ensureLoaded() {
    if (loaded.value) return;
    const data = await loadGrammar();
    items.value = data.items;
    vocabHanziByLevel.value = data.vocabHanziByLevel;

    const allProgress = await db.grammarProgress.toArray();
    const map = new Map<string, GrammarProgress>();
    for (const p of allProgress) map.set(p.itemId, p);
    progressByItem.value = map;

    newSeenToday.value = await db.grammarLogs
      .where('reviewedAt')
      .aboveOrEqual(startOfToday())
      .filter((l) => l.wasNew === true)
      .count();

    loaded.value = true;
  }

  const eligibilityCtx = computed(() => {
    const deck = useDeckStore();
    return { cards: deck.cards, vocabHanziByLevel: vocabHanziByLevel.value };
  });

  const eligibleItems = computed(() =>
    items.value.filter((it) => isItemEligible(it, eligibilityCtx.value))
  );

  const dueItems = computed(() => {
    const out: Array<{ item: GrammarItem; progress: GrammarProgress }> = [];
    for (const it of eligibleItems.value) {
      const p = progressByItem.value.get(it.id);
      if (p && p.state !== 0 && p.due <= now.value) out.push({ item: it, progress: p });
    }
    return out.sort((a, b) => a.progress.due - b.progress.due);
  });

  const newItems = computed(() =>
    eligibleItems.value.filter((it) => !progressByItem.value.has(it.id))
  );

  const newLeftToday = computed(() => Math.max(0, NEW_GRAMMAR_PER_DAY - newSeenToday.value));

  const currentItem = computed<GrammarItem | null>(() => {
    if (dueItems.value.length > 0) return dueItems.value[0].item;
    if (newLeftToday.value > 0 && newItems.value.length > 0) return newItems.value[0];
    return null;
  });

  const dueCount = computed(() => dueItems.value.length);
  const queuedNewCount = computed(() => Math.min(newLeftToday.value, newItems.value.length));
  const totalEligible = computed(() => eligibleItems.value.length);

  const levelStatus = computed(() => {
    const deck = useDeckStore();
    return GRAMMAR_LEVELS.map((lvl) => {
      const vocab = vocabHanziByLevel.value.get(lvl) ?? [];
      const mastery = vocabMasteryForLevel(deck.cards, vocab);
      const total = items.value.filter((it) => it.level === lvl).length;
      const unlocked = mastery >= 0.3;
      return { level: lvl, mastery, total, unlocked };
    });
  });

  async function record(itemId: string, progress: GrammarProgress, wasNew: boolean) {
    progressByItem.value.set(itemId, progress);
    progressByItem.value = new Map(progressByItem.value);
    if (wasNew) newSeenToday.value += 1;
    now.value = Date.now();
  }

  function refreshNow() {
    now.value = Date.now();
  }

  return {
    items,
    loaded,
    newSeenToday,
    newLeftToday,
    eligibleItems,
    dueItems,
    newItems,
    currentItem,
    dueCount,
    queuedNewCount,
    totalEligible,
    levelStatus,
    ensureLoaded,
    record,
    refreshNow,
  };
});
