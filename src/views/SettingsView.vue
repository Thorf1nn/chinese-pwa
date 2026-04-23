<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { useThemeStore } from '../stores/theme';
import { Button, Input, PageHeader, Separator } from '../components/ui';

const deck = useDeckStore();
const theme = useThemeStore();

const newPerDay = ref(8);
const saveStatus = ref<'' | 'saved'>('');

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
  newPerDay.value = deck.newCardsPerDay;
});

async function save() {
  const n = Math.max(0, Math.min(500, Math.floor(newPerDay.value)));
  newPerDay.value = n;
  await deck.updateNewCardsPerDay(n);
  saveStatus.value = 'saved';
  setTimeout(() => {
    saveStatus.value = '';
  }, 1500);
}

const presets = [3, 5, 8, 15, 20, 30, 50];

function applyPreset(n: number) {
  newPerDay.value = n;
  save();
}

function setUnlimited() {
  newPerDay.value = 500;
  save();
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader eyebrow="Réglages" title="Préférences">
      <template #action>
        <RouterLink to="/dashboard">
          <Button variant="ghost" size="sm">retour</Button>
        </RouterLink>
      </template>
    </PageHeader>

    <section class="space-y-4">
      <h2 class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Apparence</h2>
      <div class="flex items-center justify-between gap-4 border-y border-border py-4">
        <div>
          <p class="font-medium">Thème</p>
          <p class="text-xs text-muted-foreground">Clair inspiré d'un papier crème, ou sombre.</p>
        </div>
        <div class="flex gap-2">
          <Button
            size="sm"
            :variant="theme.mode === 'light' ? 'primary' : 'outline'"
            @click="theme.set('light')"
          >
            Clair
          </Button>
          <Button
            size="sm"
            :variant="theme.mode === 'dark' ? 'primary' : 'outline'"
            @click="theme.set('dark')"
          >
            Sombre
          </Button>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Nouveaux mots par jour
      </h2>
      <p class="text-xs text-muted-foreground">
        Nombre max de cartes jamais vues par jour. Les révisions FSRS restent illimitées.
      </p>

      <div class="flex items-center gap-3">
        <Input
          v-model.number="newPerDay"
          type="number"
          min="0"
          max="500"
          class="h-12 text-center font-editorial text-xl"
        />
        <Button variant="primary" @click="save">Enregistrer</Button>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="n in presets"
          :key="n"
          class="inline-flex h-8 items-center rounded-sm border px-3 text-xs transition"
          :class="newPerDay === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
          @click="applyPreset(n)"
        >
          {{ n }}/j
        </button>
        <button
          class="inline-flex h-8 items-center rounded-sm border px-3 text-xs transition"
          :class="newPerDay >= 500 ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
          @click="setUnlimited"
        >
          ∞ tout
        </button>
      </div>

      <p v-if="saveStatus === 'saved'" class="text-xs text-emerald-700 dark:text-emerald-400">
        ✓ Enregistré
      </p>

      <div class="mt-2 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p class="font-medium text-foreground">Aujourd'hui</p>
        <p class="mt-1">
          Vus :
          <span class="font-editorial text-foreground">{{ deck.newSeenToday }}</span>
          /
          <span class="font-editorial text-foreground">{{ deck.newCardsPerDay }}</span>
        </p>
        <p>
          Il te reste
          <span class="font-editorial text-emerald-700 dark:text-emerald-400">{{ deck.newLeftToday }}</span>
          nouveau(x) à découvrir aujourd'hui.
        </p>
      </div>
    </section>

    <Separator />

    <section class="space-y-2">
      <h2 class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pourquoi un cap ?</h2>
      <ul class="space-y-1 text-xs text-muted-foreground">
        <li>— FSRS fait revenir chaque carte plusieurs fois : 8 nouveaux = ~20-30 cartes vues.</li>
        <li>— 3-5 pour un rythme léger.</li>
        <li>— 20-30 pour rush un deck.</li>
        <li>— ∞ pour tout voir (attention aux repasses qui s'accumulent).</li>
      </ul>
    </section>
  </section>
</template>
