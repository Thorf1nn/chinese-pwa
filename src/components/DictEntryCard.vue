<script setup lang="ts">
import { computed } from 'vue';
import type { DictEntry } from '../lib/db';

const props = defineProps<{
  entry: DictEntry;
  alreadyInDeck?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ add: [DictEntry] }>();

const defs = computed(() => props.entry.definitions.slice(0, 4));
const extra = computed(() => Math.max(props.entry.definitions.length - defs.value.length, 0));
</script>

<template>
  <article class="card flex items-start gap-3">
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2">
        <span class="hanzi text-3xl font-semibold">{{ entry.simplified }}</span>
        <span
          v-if="entry.traditional && entry.traditional !== entry.simplified"
          class="hanzi text-lg text-slate-500"
        >
          {{ entry.traditional }}
        </span>
      </div>
      <p class="mt-1 text-sm text-brand-500">{{ entry.pinyin }}</p>
      <ul class="mt-2 space-y-0.5 text-sm text-slate-200">
        <li v-for="(d, i) in defs" :key="i" class="leading-snug">· {{ d }}</li>
      </ul>
      <p v-if="extra" class="mt-1 text-xs text-slate-500">+ {{ extra }} autre(s) sens</p>
    </div>
    <button
      class="btn shrink-0"
      :class="alreadyInDeck ? 'bg-emerald-700 text-white' : 'btn-primary'"
      :disabled="busy || alreadyInDeck"
      @click="emit('add', entry)"
    >
      <span v-if="alreadyInDeck">✓ Ajouté</span>
      <span v-else-if="busy">…</span>
      <span v-else>+ Ajouter</span>
    </button>
  </article>
</template>
