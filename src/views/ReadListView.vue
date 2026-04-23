<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { loadPreloadTexts, listUserTexts, type PreloadText } from '../lib/reader';
import type { UserText } from '../lib/db';
import { Badge, Button, PageHeader, Separator } from '../components/ui';

const preload = ref<PreloadText[]>([]);
const userTexts = ref<UserText[]>([]);
const loading = ref(true);

async function refresh() {
  loading.value = true;
  const [p, u] = await Promise.all([loadPreloadTexts(), listUserTexts()]);
  preload.value = p;
  userTexts.value = u;
  loading.value = false;
}

onMounted(refresh);

function previewContent(content: string, max = 80): string {
  if (content.length <= max) return content;
  return content.slice(0, max) + '…';
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader
      eyebrow="Lecture"
      title="Lire"
      subtitle="Des textes en chinois, tape un mot pour sa définition."
    />

    <RouterLink to="/read/new">
      <Button variant="primary" full>+ Coller mon propre texte</Button>
    </RouterLink>

    <section v-if="userTexts.length" class="space-y-4">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Mes textes
      </h2>
      <ul class="divide-y divide-border border-y border-border">
        <li v-for="t in userTexts" :key="t.id">
          <RouterLink
            :to="{ name: 'read-text', params: { id: t.id } }"
            class="block py-4 transition-colors hover:text-primary"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="hanzi text-xl font-semibold">{{ t.title }}</h3>
              <Badge v-if="t.hskLevel" variant="outline">HSK {{ t.hskLevel }}</Badge>
            </div>
            <p v-if="t.subtitle" class="mt-1 text-xs text-muted-foreground">{{ t.subtitle }}</p>
            <p class="hanzi mt-2 text-sm text-muted-foreground line-clamp-2">
              {{ previewContent(t.content) }}
            </p>
          </RouterLink>
        </li>
      </ul>
    </section>

    <Separator v-if="userTexts.length" />

    <section class="space-y-4">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Textes proposés
      </h2>
      <p v-if="loading && !preload.length" class="py-6 text-center text-sm text-muted-foreground">
        Chargement...
      </p>
      <ul v-else class="divide-y divide-border border-y border-border">
        <li v-for="t in preload" :key="t.id">
          <RouterLink
            :to="{ name: 'read-text', params: { id: t.id } }"
            class="block py-4 transition-colors hover:text-primary"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="hanzi text-xl font-semibold">{{ t.title }}</h3>
              <Badge v-if="t.hskLevel" variant="outline">HSK {{ t.hskLevel }}</Badge>
            </div>
            <p v-if="t.subtitle" class="mt-1 text-xs text-muted-foreground">{{ t.subtitle }}</p>
            <p class="hanzi mt-2 text-sm text-muted-foreground line-clamp-2">
              {{ previewContent(t.content) }}
            </p>
            <p v-if="t.description" class="mt-1 text-[11px] italic text-muted-foreground/70">
              {{ t.description }}
            </p>
          </RouterLink>
        </li>
      </ul>
    </section>
  </section>
</template>
