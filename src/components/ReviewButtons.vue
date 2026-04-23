<script setup lang="ts">
import type { ReviewRating } from '../lib/fsrs';

defineProps<{
  intervals: Record<ReviewRating, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{ rate: [ReviewRating] }>();

const order: ReviewRating[] = [1, 2, 3, 4];

const labels: Record<ReviewRating, string> = {
  1: 'Encore',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
};

const tones: Record<ReviewRating, string> = {
  1: 'hover:border-destructive/60 hover:bg-destructive/10',
  2: 'hover:border-amber-500/60 hover:bg-amber-500/10',
  3: 'hover:border-emerald-500/60 hover:bg-emerald-500/10',
  4: 'hover:border-sky-500/60 hover:bg-sky-500/10',
};
</script>

<template>
  <div class="grid grid-cols-4 gap-2">
    <button
      v-for="r in order"
      :key="r"
      class="flex flex-col items-center gap-1 rounded-md border border-border bg-card px-2 py-3 transition active:scale-95 disabled:opacity-40"
      :class="tones[r]"
      :disabled="disabled"
      @click="emit('rate', r)"
    >
      <span class="text-xs font-medium">{{ labels[r] }}</span>
      <span class="font-editorial text-[11px] tabular-nums text-muted-foreground">{{ intervals[r] }}</span>
    </button>
  </div>
</template>
