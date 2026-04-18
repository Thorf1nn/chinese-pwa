<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, RouterLink } from 'vue-router';
import { useDictStore } from './stores/dict';
import DictLoader from './components/DictLoader.vue';

const dict = useDictStore();

onMounted(async () => {
  await dict.ensureLoaded();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <DictLoader v-if="dict.status !== 'ready'" />

    <main class="flex-1 overflow-y-auto pb-20 pt-[env(safe-area-inset-top)]">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/90 backdrop-blur"
      :style="{ paddingBottom: 'min(env(safe-area-inset-bottom), 12px)' }"
    >
      <div class="mx-auto flex max-w-md items-stretch justify-around">
        <RouterLink
          v-for="item in tabs"
          :key="item.to"
          :to="item.to"
          class="flex flex-1 flex-col items-center gap-1 py-1.5 text-xs"
          active-class="text-brand-500"
        >
          <span class="text-lg">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

<script lang="ts">
const tabs = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/review', label: 'Réviser', icon: '🎯' },
  { to: '/search', label: 'Chercher', icon: '🔍' },
  { to: '/decks', label: 'HSK', icon: '🎓' },
] as const;
export default { name: 'App' };
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
