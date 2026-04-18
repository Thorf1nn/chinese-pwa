<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDeckStore } from '../stores/deck';
import { HSK_LEVELS, useHskStore, type HskLevel } from '../stores/hsk';

const deck = useDeckStore();
const hsk = useHskStore();
const importing = ref<HskLevel | null>(null);
const lastImport = ref<{ level: HskLevel; added: number; already: number; missing: number } | null>(null);

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
  await hsk.ensureLoaded();
});

function cardsInLevel(level: HskLevel): number {
  return deck.cards.filter((c) => c.tags.includes(level)).length;
}

function totalInLevel(level: HskLevel): number {
  return hsk.words(level).length;
}

const progress = computed(() => {
  const out: Record<HskLevel, number> = { hsk1: 0, hsk2: 0, hsk3: 0, hsk4: 0, hsk5: 0, hsk6: 0 };
  for (const lvl of HSK_LEVELS) {
    const total = totalInLevel(lvl.id);
    out[lvl.id] = total ? Math.round((cardsInLevel(lvl.id) / total) * 100) : 0;
  }
  return out;
});

async function importLevel(level: HskLevel) {
  if (importing.value) return;
  const total = totalInLevel(level);
  if (!confirm(`Importer ${total} mots du niveau ${level.toUpperCase()} ?\n\nTes réglages limitent les nouveaux mots à ${deck.newCardsPerDay}/jour — pas d'inquiétude, tu ne verras pas tout d'un coup.`)) {
    return;
  }
  importing.value = level;
  try {
    const { resolved, missing } = await hsk.resolveEntries(level);
    const valid = resolved.filter((e) => e.definitions.length > 0);
    const res = await deck.bulkImport(valid, [level]);
    lastImport.value = {
      level,
      added: res.added,
      already: res.alreadyPresent,
      missing: missing.length,
    };
  } finally {
    importing.value = null;
  }
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header>
      <h1 class="text-2xl font-bold">Decks HSK</h1>
      <p class="mt-1 text-sm text-slate-400">
        Importe les listes officielles. Nouveau par jour :
        <span class="font-semibold text-slate-200">{{ deck.newCardsPerDay }}</span>
      </p>
    </header>

    <div v-if="hsk.loading" class="card text-center text-slate-400">Chargement des listes…</div>

    <div
      v-if="lastImport"
      class="rounded-lg border border-emerald-700 bg-emerald-900/20 p-3 text-sm"
    >
      <p class="font-semibold text-emerald-200">
        {{ lastImport.level.toUpperCase() }} importé 🎉
      </p>
      <p class="mt-1 text-emerald-300">
        +{{ lastImport.added }} ajoutés · {{ lastImport.already }} déjà présents
        <span v-if="lastImport.missing"> · {{ lastImport.missing }} non trouvés</span>
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <article v-for="lvl in HSK_LEVELS" :key="lvl.id" class="card">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block h-3 w-3 rounded-full"
                :class="lvl.color"
              />
              <h2 class="text-lg font-semibold">{{ lvl.label }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-400">
              {{ cardsInLevel(lvl.id) }} / {{ totalInLevel(lvl.id) }} mots dans ton deck
            </p>
          </div>
          <button
            class="btn"
            :class="cardsInLevel(lvl.id) >= totalInLevel(lvl.id) && totalInLevel(lvl.id) > 0 ? 'bg-emerald-700 text-white' : 'btn-primary'"
            :disabled="importing !== null || !totalInLevel(lvl.id)"
            @click="importLevel(lvl.id)"
          >
            <span v-if="importing === lvl.id">Import…</span>
            <span v-else-if="cardsInLevel(lvl.id) >= totalInLevel(lvl.id) && totalInLevel(lvl.id) > 0">
              ✓ Complet
            </span>
            <span v-else-if="cardsInLevel(lvl.id) > 0">Compléter</span>
            <span v-else>Importer</span>
          </button>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            class="h-full transition-[width]"
            :class="lvl.color"
            :style="{ width: progress[lvl.id] + '%' }"
          />
        </div>
      </article>
    </div>

    <p class="mt-2 text-center text-xs text-slate-500">
      Source : HSK 2.0 officiel (2012) via
      <a class="underline" href="https://github.com/glxxyz/hskhsk.com" target="_blank" rel="noopener">hskhsk.com</a>
    </p>
  </section>
</template>
