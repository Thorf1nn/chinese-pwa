<script setup lang="ts">
import { computed } from 'vue';
import type { DictEntry } from '../lib/db';
import { Badge, Button } from './ui';

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
  <article class="flex items-start gap-4 border-b border-border pb-5">
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <span class="hanzi text-3xl font-semibold">{{ entry.simplified }}</span>
        <span
          v-if="entry.traditional && entry.traditional !== entry.simplified"
          class="hanzi text-lg text-muted-foreground"
        >
          {{ entry.traditional }}
        </span>
      </div>
      <p class="mt-1 font-editorial text-sm text-primary">{{ entry.pinyin }}</p>
      <ul class="mt-2 space-y-0.5 text-sm">
        <li v-for="(d, i) in defs" :key="i">— {{ d }}</li>
      </ul>
      <p v-if="extra" class="mt-1 text-[11px] text-muted-foreground">+ {{ extra }} autre(s) sens</p>
    </div>
    <Button
      :variant="alreadyInDeck ? 'outline' : 'primary'"
      size="sm"
      :disabled="busy || alreadyInDeck"
      @click="emit('add', entry)"
    >
      <span v-if="alreadyInDeck">✓</span>
      <span v-else-if="busy">…</span>
      <span v-else>+ ajouter</span>
    </Button>
  </article>
</template>
