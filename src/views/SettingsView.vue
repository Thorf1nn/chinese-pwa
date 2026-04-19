<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useDeckStore } from '../stores/deck';

const deck = useDeckStore();

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
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Réglages</h1>
      <RouterLink to="/dashboard" class="text-sm text-slate-400">← Dashboard</RouterLink>
    </header>

    <article class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Nouveaux mots par jour
      </h2>
      <p class="mt-1 text-xs text-slate-500">
        Nombre max de cartes jamais vues qui t'apparaissent chaque jour. Les révisions FSRS
        restent illimitées.
      </p>

      <div class="mt-4 flex items-center gap-3">
        <input
          v-model.number="newPerDay"
          type="number"
          min="0"
          max="500"
          class="flex-1 rounded-lg bg-slate-800 px-3 py-3 text-center text-2xl font-bold ring-1 ring-slate-700 focus:outline-none focus:ring-brand-500"
        />
        <button class="btn-primary" @click="save">Enregistrer</button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="n in presets"
          :key="n"
          class="chip"
          :class="newPerDay === n ? 'bg-brand-500 text-white' : ''"
          @click="applyPreset(n)"
        >
          {{ n }}/j
        </button>
        <button
          class="chip"
          :class="newPerDay >= 500 ? 'bg-brand-500 text-white' : ''"
          @click="setUnlimited"
        >
          ∞ Tout
        </button>
      </div>

      <p v-if="saveStatus === 'saved'" class="mt-3 text-xs text-emerald-400">✓ Enregistré</p>

      <div class="mt-4 rounded-md bg-slate-800/50 p-3 text-xs text-slate-400">
        <p class="font-semibold text-slate-200">État aujourd'hui</p>
        <p class="mt-1">
          Vus : <span class="text-slate-200">{{ deck.newSeenToday }}</span> /
          <span class="text-slate-200">{{ deck.newCardsPerDay }}</span>
        </p>
        <p>
          Il te reste <span class="text-emerald-400">{{ deck.newLeftToday }}</span> nouveau(x) à
          découvrir aujourd'hui.
        </p>
      </div>
    </article>

    <article class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Pourquoi un cap ?
      </h2>
      <ul class="mt-2 space-y-1 text-xs text-slate-400">
        <li>
          · FSRS fait revenir chaque carte plusieurs fois pour la fixer → 8 nouveaux/jour = en
          général 20-30 cartes vues
        </li>
        <li>· Baisse à 3-5 si tu veux un rythme léger</li>
        <li>· Monte à 20-30 pour rush un deck</li>
        <li>· ∞ si tu veux tout voir sans filet (attention aux repasses)</li>
      </ul>
    </article>
  </section>
</template>
