<script lang="ts">
import {
  LayoutDashboard,
  Target,
  BookOpen,
  Camera,
  Search,
  GraduationCap,
} from 'lucide-vue-next';

export const tabs = [
  { to: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { to: '/review', label: 'Réviser', icon: Target },
  { to: '/read', label: 'Lire', icon: BookOpen },
  { to: '/scan', label: 'Scanner', icon: Camera },
  { to: '/search', label: 'Chercher', icon: Search },
  { to: '/decks', label: 'Decks', icon: GraduationCap },
] as const;

export default { name: 'App' };
</script>

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
      style="padding-bottom: calc(6.5rem + env(safe-area-inset-bottom))"
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
      <div class="mx-auto flex max-w-md items-stretch px-2">
        <RouterLink
          v-for="item in tabs"
          :key="item.to"
          :to="item.to"
          class="group flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          active-class="!text-primary"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.6" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

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
