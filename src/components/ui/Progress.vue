<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    value?: number;
    segments?: Array<{ value: number; class?: string }>;
    class?: string;
  }>(),
  { value: 0 }
);

const rootClasses = computed(() =>
  cn('relative h-1 w-full overflow-hidden rounded-full bg-border', props.class)
);
</script>

<template>
  <div :class="rootClasses">
    <div v-if="!segments" class="h-full bg-primary transition-[width]" :style="{ width: value + '%' }" />
    <div v-else class="flex h-full">
      <div
        v-for="(s, i) in segments"
        :key="i"
        class="h-full transition-[width]"
        :class="s.class"
        :style="{ width: s.value + '%' }"
      />
    </div>
  </div>
</template>
