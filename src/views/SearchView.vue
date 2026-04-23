<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { DictEntry } from '../lib/db';
import { searchDictionary } from '../lib/search';
import { useDeckStore } from '../stores/deck';
import { useDictStore } from '../stores/dict';
import DictEntryCard from '../components/DictEntryCard.vue';
import { Input, PageHeader } from '../components/ui';

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
  <section class="mx-auto flex max-w-xl flex-col gap-6 px-6 pt-8">
    <PageHeader
      eyebrow="Dictionnaire"
      title="Chercher"
      subtitle="Hanzi, pinyin (sans tons), ou mot français."
    />

    <Input
      v-model="query"
      type="search"
      inputmode="search"
      autofocus
      placeholder="你好, ni hao, bonjour…"
      class="h-12 text-base"
    />

    <p v-if="dict.status !== 'ready'" class="text-sm text-muted-foreground">
      Dictionnaire en cours de chargement…
    </p>
    <p v-else-if="loading" class="text-sm text-muted-foreground">Recherche…</p>
    <p v-else-if="query && results.length === 0" class="text-sm text-muted-foreground">
      Aucun résultat.
    </p>

    <div class="flex flex-col gap-5">
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
