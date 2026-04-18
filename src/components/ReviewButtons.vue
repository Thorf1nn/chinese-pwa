<script setup lang="ts">
import { RATING_LABELS, type ReviewRating } from '../lib/fsrs';

defineProps<{
  intervals: Record<ReviewRating, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{ rate: [ReviewRating] }>();

const order: ReviewRating[] = [1, 2, 3, 4];
</script>

<template>
  <div class="grid grid-cols-4 gap-2">
    <button
      v-for="r in order"
      :key="r"
      class="flex flex-col items-center gap-1 rounded-lg py-3 text-white transition active:scale-95 disabled:opacity-40"
      :class="RATING_LABELS[r].color"
      :disabled="disabled"
      @click="emit('rate', r)"
    >
      <span class="text-xs font-semibold uppercase tracking-wide">{{ RATING_LABELS[r].label }}</span>
      <span class="text-xs opacity-80">{{ intervals[r] }}</span>
    </button>
  </div>
</template>
