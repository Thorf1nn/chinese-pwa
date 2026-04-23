<script setup lang="ts">
import { watch } from 'vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

function close() {
  emit('update:open', false);
}

watch(
  () => props.open,
  (o) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = o ? 'hidden' : '';
  }
);
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        @click="close"
      />
    </transition>
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border-t border-border bg-card p-6 shadow-xl"
        style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom))"
      >
        <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <slot :close="close" />
      </div>
    </transition>
  </teleport>
</template>
