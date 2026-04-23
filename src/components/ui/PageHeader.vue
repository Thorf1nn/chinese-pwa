<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <header class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {{ eyebrow }}
      </p>
      <h1 class="mt-1 font-serif text-3xl font-semibold tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-muted-foreground">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </header>
</template>
