<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Card } from '../lib/db';

const props = defineProps<{ card: Card }>();
const revealed = ref(false);

watch(
  () => props.card.id,
  () => {
    revealed.value = false;
  }
);

function reveal() {
  revealed.value = true;
}

defineExpose({ revealed });
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4">
    <div class="card w-full max-w-md text-center">
      <p class="hanzi text-7xl font-semibold tracking-wide">{{ card.simplified }}</p>

      <template v-if="revealed">
        <p class="mt-4 text-xl text-brand-500">{{ card.pinyin }}</p>
        <ul class="mt-4 space-y-1 text-base text-slate-200">
          <li v-for="(d, i) in card.definitions" :key="i">· {{ d }}</li>
        </ul>

        <div v-if="card.sentences.length" class="mt-6 space-y-3 border-t border-slate-800 pt-4 text-left">
          <p class="text-xs uppercase tracking-wide text-slate-500">Exemples</p>
          <div
            v-for="s in card.sentences"
            :key="s.id"
            class="rounded-lg bg-slate-800/60 p-3 text-sm"
          >
            <p class="hanzi text-lg text-slate-100">{{ s.zh }}</p>
            <p v-if="s.fr" class="mt-1 text-slate-300">{{ s.fr }}</p>
            <p v-if="s.source" class="mt-1 text-xs text-slate-500">— {{ s.source }}</p>
          </div>
        </div>
      </template>

      <button v-else class="btn-primary mt-8 w-full" @click="reveal">
        Afficher la réponse
      </button>
    </div>
  </div>
</template>
