<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cn } from '../../lib/utils';

const props = defineProps<{ modelValue?: string | number; class?: string }>();
const emit = defineEmits<{ 'update:modelValue': [string | number] }>();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

const classes = computed(() =>
  cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class
  )
);
</script>

<template>
  <input
    :value="modelValue"
    v-bind="attrs"
    :class="classes"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
