import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db } from '../lib/db';

const HSK_URL = `${import.meta.env.BASE_URL}hsk.json`;

interface HskPayload {
  version: string;
  source: string;
  levels: Record<string, string[]>;
}

export type HskLevel = 'hsk1' | 'hsk2' | 'hsk3' | 'hsk4' | 'hsk5' | 'hsk6';

export const HSK_LEVELS: Array<{ id: HskLevel; label: string; color: string }> = [
  { id: 'hsk1', label: 'HSK 1', color: 'bg-emerald-600' },
  { id: 'hsk2', label: 'HSK 2', color: 'bg-teal-600' },
  { id: 'hsk3', label: 'HSK 3', color: 'bg-sky-600' },
  { id: 'hsk4', label: 'HSK 4', color: 'bg-indigo-600' },
  { id: 'hsk5', label: 'HSK 5', color: 'bg-purple-600' },
  { id: 'hsk6', label: 'HSK 6', color: 'bg-rose-600' },
];

export const useHskStore = defineStore('hsk', () => {
  const payload = ref<HskPayload | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function ensureLoaded() {
    if (payload.value || loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(HSK_URL);
      if (!res.ok) throw new Error(`${res.status}`);
      payload.value = (await res.json()) as HskPayload;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  function words(level: HskLevel): string[] {
    return payload.value?.levels[level] ?? [];
  }

  async function resolveEntries(level: HskLevel) {
    const list = words(level);
    const resolved: Array<{ simplified: string; pinyin: string; definitions: string[] }> = [];
    const missing: string[] = [];
    for (const word of list) {
      const entry = await db.dict.where('simplified').equals(word).first();
      if (entry) {
        resolved.push({
          simplified: entry.simplified,
          pinyin: entry.pinyin,
          definitions: entry.definitions,
        });
      } else {
        missing.push(word);
        resolved.push({
          simplified: word,
          pinyin: '',
          definitions: [],
        });
      }
    }
    return { resolved, missing };
  }

  return { payload, loading, error, ensureLoaded, words, resolveEntries };
});
