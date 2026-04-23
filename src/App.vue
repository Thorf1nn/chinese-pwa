<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, RouterLink } from 'vue-router';
import { useDictStore } from './stores/dict';
import { useThemeStore } from './stores/theme';
import DictLoader from './components/DictLoader.vue';

const dict = useDictStore();
useThemeStore();

onMounted(async () => {
  await dict.ensureLoaded();
});
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col bg-background text-foreground">
    <DictLoader v-if="dict.status !== 'ready'" />

    <main
      class="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]"
      style="padding-bottom: calc(7rem + env(safe-area-inset-bottom))"
    >
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>

      <footer class="mt-16 px-6 pb-4 text-center">
        <p class="hanzi text-sm text-muted-foreground/70">
          汉字 · <span class="italic">hànzì</span>
        </p>
      </footer>
    </main>

    <nav
      class="nav-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur"
    >
      <div class="mx-auto flex max-w-md items-stretch overflow-x-auto px-2">
        <RouterLink
          v-for="item in tabs"
          :key="item.to"
          :to="item.to"
          class="flex flex-1 flex-col items-center justify-center py-2.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
          active-class="!text-primary"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

<script lang="ts">
const tabs = [
  { to: '/dashboard', label: 'Accueil' },
  { to: '/review', label: 'Réviser' },
  { to: '/read', label: 'Lire' },
  { to: '/scan', label: 'Scanner' },
  { to: '/search', label: 'Chercher' },
  { to: '/decks', label: 'Decks' },
] as const;
export default { name: 'App' };
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.nav-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
