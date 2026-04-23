<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDeckStore } from '../stores/deck';
import { HSK_LEVELS, useHskStore, type HskLevel } from '../stores/hsk';
import { Badge, Button, PageHeader, Progress, Separator } from '../components/ui';

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
  if (!confirm(`Importer ${total} mots du niveau ${level.toUpperCase()} ?\n\nLes nouveaux mots restent limités à ${deck.newCardsPerDay}/jour.`)) {
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

function isComplete(level: HskLevel) {
  return cardsInLevel(level) >= totalInLevel(level) && totalInLevel(level) > 0;
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader
      eyebrow="Decks HSK"
      title="Listes officielles"
      subtitle="Importe un niveau d'un coup. Le cap nouveaux/jour s'applique."
    />

    <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      Nouveau par jour :
      <span class="font-editorial text-sm text-foreground">{{ deck.newCardsPerDay }}</span>
    </p>

    <p v-if="hsk.loading" class="text-sm text-muted-foreground">Chargement des listes…</p>

    <div
      v-if="lastImport"
      class="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
    >
      {{ lastImport.level.toUpperCase() }} importé — +{{ lastImport.added }} ajouté(s),
      {{ lastImport.already }} déjà là<span v-if="lastImport.missing">, {{ lastImport.missing }} non trouvés</span>.
    </div>

    <ul class="divide-y divide-border border-y border-border">
      <li v-for="lvl in HSK_LEVELS" :key="lvl.id" class="py-5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="font-serif text-xl font-semibold">{{ lvl.label }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ cardsInLevel(lvl.id) }} / {{ totalInLevel(lvl.id) }} mots
            </p>
          </div>
          <Button
            v-if="isComplete(lvl.id)"
            variant="outline"
            size="sm"
            disabled
          >
            ✓ complet
          </Button>
          <Button
            v-else
            variant="primary"
            size="sm"
            :disabled="importing !== null || !totalInLevel(lvl.id)"
            @click="importLevel(lvl.id)"
          >
            <span v-if="importing === lvl.id">…</span>
            <span v-else-if="cardsInLevel(lvl.id) > 0">compléter</span>
            <span v-else>importer</span>
          </Button>
        </div>
        <div class="mt-3">
          <Progress :value="progress[lvl.id]" />
        </div>
      </li>
    </ul>

    <p class="text-center text-[11px] italic text-muted-foreground/70">
      Source : HSK 2.0 officiel (2012) via
      <a class="underline underline-offset-4" href="https://github.com/glxxyz/hskhsk.com" target="_blank" rel="noopener">hskhsk.com</a>
    </p>
  </section>
</template>
