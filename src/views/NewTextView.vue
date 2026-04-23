<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { saveUserText } from '../lib/reader';
import { Button, Input, PageHeader, Textarea } from '../components/ui';

const router = useRouter();
const title = ref('');
const content = ref('');
const hskLevel = ref<number | null>(null);
const saving = ref(false);

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function save() {
  if (!title.value.trim() || !content.value.trim() || saving.value) return;
  saving.value = true;
  try {
    const text = await saveUserText({
      id: uuid(),
      title: title.value.trim(),
      content: content.value.trim(),
      hskLevel: hskLevel.value ?? undefined,
    });
    router.replace({ name: 'read-text', params: { id: text.id } });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader eyebrow="Nouveau texte" title="Coller un texte">
      <template #action>
        <RouterLink to="/read">
          <Button variant="ghost" size="sm">retour</Button>
        </RouterLink>
      </template>
    </PageHeader>

    <p class="text-sm text-muted-foreground">
      Paroles, article, transcription de podcast...
    </p>

    <form class="space-y-6" @submit.prevent="save">
      <div class="space-y-2">
        <label class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Titre</label>
        <Input v-model="title" required placeholder="Paroles de 蛋堡 · 过程" />
      </div>

      <div class="space-y-2">
        <label class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Niveau HSK (optionnel)</label>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs transition"
            :class="hskLevel === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
            @click="hskLevel = null"
          >
            —
          </button>
          <button
            v-for="n in [1, 2, 3, 4, 5, 6]"
            :key="n"
            type="button"
            class="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs transition"
            :class="hskLevel === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
            @click="hskLevel = n"
          >
            HSK {{ n }}
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Texte chinois</label>
        <Textarea v-model="content" required rows="12" class="hanzi min-h-[240px]" placeholder="Colle ton texte ici..." />
      </div>

      <Button
        type="submit"
        variant="primary"
        full
        :disabled="!title.trim() || !content.trim() || saving"
      >
        <span v-if="saving">Enregistrement...</span>
        <span v-else>Commencer la lecture</span>
      </Button>
    </form>
  </section>
</template>
