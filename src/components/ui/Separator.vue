<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical';
    class?: string;
  }>(),
  { orientation: 'horizontal' }
);

const classes = computed(() =>
  cn(
    'bg-border shrink-0',
    props.orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
    props.class
  )
);
</script>

<template>
  <div role="separator" :class="classes" />
</template>
