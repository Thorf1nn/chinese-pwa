import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db, getMeta, setMeta, type DictEntry } from '../lib/db';

const DICT_VERSION_KEY = 'dict:version';
const DICT_URL = `${import.meta.env.BASE_URL}cedict.json`;

export const useDictStore = defineStore('dict', () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const progress = ref(0);
  const total = ref(0);
  const message = ref('');
  const error = ref<string | null>(null);

  async function ensureLoaded() {
    if (status.value === 'loading' || status.value === 'ready') return;
    status.value = 'loading';
    error.value = null;

    try {
      const storedVersion = await getMeta<string>(DICT_VERSION_KEY);
      const count = await db.dict.count();

      if (count > 0 && storedVersion) {
        status.value = 'ready';
        return;
      }

      message.value = 'Téléchargement du dictionnaire…';
      const res = await fetch(DICT_URL);
      if (!res.ok) throw new Error(`Impossible de récupérer CFDICT (${res.status})`);

      const payload = (await res.json()) as { version: string; entries: DictEntry[] };
      total.value = payload.entries.length;

      message.value = 'Import en base…';
      await db.dict.clear();
      const chunkSize = 1000;
      for (let i = 0; i < payload.entries.length; i += chunkSize) {
        const chunk = payload.entries.slice(i, i + chunkSize);
        await db.dict.bulkAdd(chunk);
        progress.value = Math.min(i + chunk.length, payload.entries.length);
      }

      await setMeta(DICT_VERSION_KEY, payload.version);
      status.value = 'ready';
    } catch (err) {
      console.error('[dict] Failed to load', err);
      error.value = err instanceof Error ? err.message : String(err);
      status.value = 'error';
    }
  }

  return { status, progress, total, message, error, ensureLoaded };
});
