<script setup lang="ts">
defineProps<{
  value: string | number;
  label: string;
  hint?: string;
}>();
</script>

<template>
  <div>
    <p class="font-serif text-4xl font-semibold tracking-tight">{{ value }}</p>
    <p class="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{{ label }}</p>
    <p v-if="hint" class="mt-0.5 text-xs text-muted-foreground/70">{{ hint }}</p>
  </div>
</template>
