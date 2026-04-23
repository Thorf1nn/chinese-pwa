<script setup lang="ts">
import { cn } from '../../lib/utils';

interface TabItem {
  value: string;
  label: string;
  disabled?: boolean;
}

const props = defineProps<{
  modelValue: string;
  items: TabItem[];
  class?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [string] }>();
</script>

<template>
  <div
    :class="cn('inline-flex items-center rounded-md bg-muted p-1 text-muted-foreground', props.class)"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      :disabled="item.disabled"
      :class="
        cn(
          'inline-flex min-w-0 flex-1 items-center justify-center rounded-[calc(theme(borderRadius.md)-2px)] px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
          props.modelValue === item.value
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:text-foreground'
        )
      "
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
