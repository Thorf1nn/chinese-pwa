<script setup lang="ts">
import { computed } from 'vue';
import { useDictStore } from '../stores/dict';

const dict = useDictStore();
const pct = computed(() => {
  if (!dict.total) return 0;
  return Math.round((dict.progress / dict.total) * 100);
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
    <div class="hanzi text-6xl text-brand-500">中</div>
    <h1 class="mt-4 text-2xl font-bold">Chinese Learner</h1>
    <p class="mt-2 max-w-xs text-sm text-slate-400">
      {{ dict.message || 'Initialisation du dictionnaire…' }}
    </p>

    <div class="mt-6 w-full max-w-sm">
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          class="h-full bg-brand-500 transition-[width]"
          :style="{ width: dict.status === 'loading' ? pct + '%' : '0%' }"
        />
      </div>
      <p v-if="dict.status === 'loading'" class="mt-2 text-xs text-slate-500">
        {{ dict.progress.toLocaleString('fr-FR') }} / {{ dict.total.toLocaleString('fr-FR') }} ({{ pct }}%)
      </p>
    </div>

    <div v-if="dict.status === 'error'" class="mt-6 rounded-lg bg-red-900/40 p-4 text-sm text-red-200">
      <p class="font-medium">Erreur pendant le chargement :</p>
      <p class="mt-1 text-xs text-red-300">{{ dict.error }}</p>
      <button class="mt-3 btn btn-primary" @click="dict.ensureLoaded()">Réessayer</button>
    </div>
  </div>
</template>
