import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const KEY = 'chinese-pwa:theme';
type Mode = 'light' | 'dark';

function initial(): Mode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(mode: Mode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<Mode>(initial());
  apply(mode.value);

  watch(mode, (m) => {
    localStorage.setItem(KEY, m);
    apply(m);
  });

  function toggle() {
    mode.value = mode.value === 'light' ? 'dark' : 'light';
  }

  function set(m: Mode) {
    mode.value = m;
  }

  return { mode, toggle, set };
});
