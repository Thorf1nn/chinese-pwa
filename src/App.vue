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
  <div class="flex min-h-[100dvh] flex-col">
    <DictLoader v-if="dict.status !== 'ready'" />

    <main
      class="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]"
      style="padding-bottom: calc(5rem + env(safe-area-inset-bottom))"
    >
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <nav class="nav-bottom fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <div class="mx-auto flex max-w-md items-stretch justify-around">
        <RouterLink
          v-for="item in tabs"
          :key="item.to"
          :to="item.to"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
          active-class="text-brand-500"
        >
          <span class="text-lg leading-none">{{ item.icon }}</span>
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
  { to: '/read', label: 'Lire', icon: '📖' },
  { to: '/scan', label: 'Scan', icon: '📷' },
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

.nav-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
