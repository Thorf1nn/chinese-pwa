<script setup lang="ts">
import { computed } from 'vue';
import { useDictStore } from '../stores/dict';
import { Button, Progress } from './ui';

const dict = useDictStore();
const pct = computed(() => {
  if (!dict.total) return 0;
  return Math.round((dict.progress / dict.total) * 100);
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-8 text-center">
    <div class="hanzi text-7xl text-primary">中</div>
    <h1 class="mt-6 font-serif text-3xl font-semibold">汉字</h1>
    <p class="mt-2 max-w-sm text-sm text-muted-foreground">
      {{ dict.message || 'Initialisation du dictionnaire' }}
    </p>

    <div class="mt-8 w-full max-w-sm">
      <Progress :value="dict.status === 'loading' ? pct : 0" />
      <p v-if="dict.status === 'loading'" class="mt-2 text-xs text-muted-foreground">
        {{ dict.progress.toLocaleString('fr-FR') }} / {{ dict.total.toLocaleString('fr-FR') }}
      </p>
    </div>

    <div v-if="dict.status === 'error'" class="mt-8 max-w-sm space-y-3 text-sm">
      <p class="text-destructive">Erreur pendant le chargement</p>
      <p class="text-xs text-muted-foreground">{{ dict.error }}</p>
      <Button variant="primary" @click="dict.ensureLoaded()">Réessayer</Button>
    </div>
  </div>
</template>
