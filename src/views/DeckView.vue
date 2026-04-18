<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { HSK_LEVELS } from '../stores/hsk';
import type { Card } from '../lib/db';

const deck = useDeckStore();
const filter = ref<'all' | 'due' | 'new'>('all');
const tagFilter = ref<string>('');

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
});

const availableTags = computed(() => {
  const set = new Set<string>();
  for (const c of deck.cards) for (const t of c.tags) set.add(t);
  return Array.from(set).sort();
});

const shown = computed(() => {
  const now = Date.now();
  let list = deck.cards;
  if (filter.value === 'due') list = list.filter((c) => c.due <= now);
  else if (filter.value === 'new') list = list.filter((c) => c.state === 0);
  if (tagFilter.value) list = list.filter((c) => c.tags.includes(tagFilter.value));
  return list;
});

function tagLabel(tag: string): string {
  const hsk = HSK_LEVELS.find((h) => h.id === tag);
  return hsk ? hsk.label : tag;
}

function stateLabel(c: Card): string {
  switch (c.state) {
    case 0:
      return 'Nouveau';
    case 1:
      return 'Apprentissage';
    case 2:
      return 'Révision';
    case 3:
      return 'Reprise';
  }
}

function formatDue(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return 'Maintenant';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `dans ${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `dans ${hours}h`;
  const days = Math.round(hours / 24);
  return `dans ${days}j`;
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Mes mots</h1>
      <span class="chip">{{ deck.totalCount }} cartes</span>
    </header>

    <div class="flex gap-2">
      <button
        v-for="f in ['all', 'due', 'new'] as const"
        :key="f"
        class="btn"
        :class="filter === f ? 'bg-brand-500 text-white' : 'btn-ghost'"
        @click="filter = f"
      >
        {{ f === 'all' ? 'Tous' : f === 'due' ? 'À revoir' : 'Nouveaux' }}
      </button>
    </div>

    <div v-if="availableTags.length" class="flex flex-wrap gap-2">
      <button
        class="chip"
        :class="tagFilter === '' ? 'bg-brand-500 text-white' : ''"
        @click="tagFilter = ''"
      >
        Tous
      </button>
      <button
        v-for="tag in availableTags"
        :key="tag"
        class="chip"
        :class="tagFilter === tag ? 'bg-brand-500 text-white' : ''"
        @click="tagFilter = tag"
      >
        {{ tagLabel(tag) }}
      </button>
    </div>

    <div v-if="shown.length === 0" class="card text-center text-slate-400">
      Aucune carte dans cette vue.
    </div>

    <RouterLink
      v-for="card in shown"
      :key="card.id"
      :to="{ name: 'card', params: { id: card.id } }"
      class="card flex items-center gap-3 hover:bg-slate-800/60"
    >
      <div class="flex-1 min-w-0">
        <p class="hanzi text-2xl font-semibold">{{ card.simplified }}</p>
        <p class="text-sm text-brand-500">{{ card.pinyin }}</p>
        <p class="truncate text-xs text-slate-400">{{ card.definitions.slice(0, 2).join(' · ') }}</p>
      </div>
      <div class="text-right text-xs text-slate-500">
        <p>{{ stateLabel(card) }}</p>
        <p>{{ formatDue(card.due) }}</p>
      </div>
    </RouterLink>
  </section>
</template>
