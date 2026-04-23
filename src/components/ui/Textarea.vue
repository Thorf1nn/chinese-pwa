<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cn } from '../../lib/utils';

const props = defineProps<{ modelValue?: string; class?: string }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

const classes = computed(() =>
  cn(
    'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class
  )
);
</script>

<template>
  <textarea
    :value="modelValue"
    v-bind="attrs"
    :class="classes"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
