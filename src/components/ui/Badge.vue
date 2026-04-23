<script setup lang="ts">
import { computed } from 'vue';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'outline' | 'primary' | 'success' | 'warning' | 'destructive';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground',
        primary: 'bg-primary/10 text-primary',
        success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const props = defineProps<{ variant?: Variant; class?: string }>();

const classes = computed(() => cn(badgeVariants({ variant: props.variant ?? 'default' }), props.class));
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
