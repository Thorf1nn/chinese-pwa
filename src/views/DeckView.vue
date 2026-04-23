<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { HSK_LEVELS } from '../stores/hsk';
import type { Card } from '../lib/db';
import { PageHeader } from '../components/ui';

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
      return 'nouveau';
    case 1:
      return 'apprentissage';
    case 2:
      return 'révision';
    case 3:
      return 'reprise';
  }
}

function formatDue(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return 'maintenant';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `dans ${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `dans ${hours}h`;
  const days = Math.round(hours / 24);
  return `dans ${days}j`;
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-6 px-6 pt-8">
    <PageHeader
      eyebrow="Deck"
      title="Mes mots"
      :subtitle="`${deck.totalCount} cartes au total`"
    />

    <div class="flex gap-2">
      <button
        v-for="f in (['all', 'due', 'new'] as const)"
        :key="f"
        class="inline-flex h-9 flex-1 items-center justify-center rounded-md border text-sm transition"
        :class="filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
        @click="filter = f"
      >
        {{ f === 'all' ? 'Tous' : f === 'due' ? 'À revoir' : 'Nouveaux' }}
      </button>
    </div>

    <div v-if="availableTags.length" class="flex flex-wrap gap-1.5">
      <button
        class="inline-flex h-7 items-center rounded-sm border px-2 text-[11px] uppercase tracking-wide transition"
        :class="tagFilter === '' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
        @click="tagFilter = ''"
      >
        tous
      </button>
      <button
        v-for="tag in availableTags"
        :key="tag"
        class="inline-flex h-7 items-center rounded-sm border px-2 text-[11px] uppercase tracking-wide transition"
        :class="tagFilter === tag ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
        @click="tagFilter = tag"
      >
        {{ tagLabel(tag) }}
      </button>
    </div>

    <p v-if="shown.length === 0" class="py-12 text-center text-sm text-muted-foreground">
      Aucune carte dans cette vue.
    </p>

    <ul v-else class="divide-y divide-border border-y border-border">
      <li v-for="card in shown" :key="card.id">
        <RouterLink
          :to="{ name: 'card', params: { id: card.id } }"
          class="flex items-center gap-4 py-4 transition-colors hover:text-primary"
        >
          <div class="min-w-0 flex-1">
            <p class="hanzi text-2xl font-semibold">{{ card.simplified }}</p>
            <p class="font-editorial text-sm text-primary">{{ card.pinyin }}</p>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ card.definitions.slice(0, 2).join(' · ') }}</p>
          </div>
          <div class="shrink-0 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
            <p>{{ stateLabel(card) }}</p>
            <p class="font-editorial normal-case">{{ formatDue(card.due) }}</p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
