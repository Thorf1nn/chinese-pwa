<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../lib/utils';

const props = defineProps<{ class?: string; subtle?: boolean }>();

const classes = computed(() =>
  cn(
    'rounded-lg border border-border bg-card p-6',
    props.subtle && 'border-dashed bg-transparent',
    props.class
  )
);
</script>

<template>
  <section :class="classes">
    <slot />
  </section>
</template>
