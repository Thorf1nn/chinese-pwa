<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { loadPreloadTexts, listUserTexts, type PreloadText } from '../lib/reader';
import type { UserText } from '../lib/db';

const preload = ref<PreloadText[]>([]);
const userTexts = ref<UserText[]>([]);
const loading = ref(true);

async function refresh() {
  loading.value = true;
  const [p, u] = await Promise.all([loadPreloadTexts(), listUserTexts()]);
  preload.value = p;
  userTexts.value = u;
  loading.value = false;
}

onMounted(refresh);

function levelColor(lvl: number | undefined): string {
  switch (lvl) {
    case 1:
      return 'bg-emerald-600';
    case 2:
      return 'bg-teal-600';
    case 3:
      return 'bg-sky-600';
    case 4:
      return 'bg-indigo-600';
    case 5:
      return 'bg-purple-600';
    case 6:
      return 'bg-rose-600';
    default:
      return 'bg-slate-600';
  }
}

function previewContent(content: string, max = 60): string {
  if (content.length <= max) return content;
  return content.slice(0, max) + '…';
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Lire</h1>
        <p class="mt-1 text-sm text-slate-400">
          Lis des textes chinois, tape sur n'importe quel mot pour voir sa définition.
        </p>
      </div>
    </header>

    <RouterLink to="/read/new" class="btn-primary">
      + Coller mon propre texte
    </RouterLink>

    <section v-if="userTexts.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Mes textes</h2>
      <RouterLink
        v-for="t in userTexts"
        :key="t.id"
        :to="{ name: 'read-text', params: { id: t.id } }"
        class="card block hover:bg-slate-800/60"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="hanzi text-lg font-semibold">{{ t.title }}</h3>
          <span v-if="t.hskLevel" class="chip" :class="levelColor(t.hskLevel)">
            HSK {{ t.hskLevel }}
          </span>
        </div>
        <p v-if="t.subtitle" class="text-xs text-slate-400">{{ t.subtitle }}</p>
        <p class="hanzi mt-2 text-sm text-slate-300">{{ previewContent(t.content) }}</p>
      </RouterLink>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Textes proposés</h2>
      <div v-if="loading && !preload.length" class="card text-center text-slate-400">
        Chargement...
      </div>
      <RouterLink
        v-for="t in preload"
        :key="t.id"
        :to="{ name: 'read-text', params: { id: t.id } }"
        class="card block hover:bg-slate-800/60"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="hanzi text-lg font-semibold">{{ t.title }}</h3>
          <span v-if="t.hskLevel" class="chip" :class="levelColor(t.hskLevel)">
            HSK {{ t.hskLevel }}
          </span>
        </div>
        <p v-if="t.subtitle" class="text-xs text-slate-400">{{ t.subtitle }}</p>
        <p class="hanzi mt-2 text-sm text-slate-300">{{ previewContent(t.content) }}</p>
        <p v-if="t.description" class="mt-1 text-xs text-slate-500">{{ t.description }}</p>
      </RouterLink>
    </section>
  </section>
</template>
