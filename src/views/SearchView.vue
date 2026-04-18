<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { DictEntry } from '../lib/db';
import { searchDictionary } from '../lib/search';
import { useDeckStore } from '../stores/deck';
import { useDictStore } from '../stores/dict';
import DictEntryCard from '../components/DictEntryCard.vue';

const deck = useDeckStore();
const dict = useDictStore();

const query = ref('');
const results = ref<DictEntry[]>([]);
const loading = ref(false);
const busyId = ref<number | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
});

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q.trim()) {
    results.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      results.value = await searchDictionary(q);
    } finally {
      loading.value = false;
    }
  }, 200);
});

function inDeck(simplified: string) {
  return deck.cards.some((c) => c.simplified === simplified);
}

async function add(entry: DictEntry) {
  busyId.value = entry.id ?? null;
  try {
    await deck.addFromDictEntry(entry);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header>
      <h1 class="text-2xl font-bold">Chercher un mot</h1>
      <p class="mt-1 text-sm text-slate-400">Hanzi, pinyin (sans tons ok) ou mot français.</p>
    </header>

    <input
      v-model="query"
      type="search"
      inputmode="search"
      autofocus
      placeholder="你好, ni hao, bonjour…"
      class="w-full rounded-xl bg-slate-900 px-4 py-3 text-lg ring-1 ring-slate-800 focus:outline-none focus:ring-brand-500"
    />

    <p v-if="dict.status !== 'ready'" class="text-sm text-slate-500">
      Dictionnaire en cours de chargement…
    </p>

    <p v-else-if="loading" class="text-sm text-slate-500">Recherche…</p>

    <div v-else-if="query && results.length === 0" class="card text-center text-slate-400">
      Aucun résultat.
    </div>

    <div class="flex flex-col gap-3">
      <DictEntryCard
        v-for="entry in results"
        :key="entry.id"
        :entry="entry"
        :already-in-deck="inDeck(entry.simplified)"
        :busy="busyId === entry.id"
        @add="add"
      />
    </div>
  </section>
</template>
