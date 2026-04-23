<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { saveUserText } from '../lib/reader';

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
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header>
      <RouterLink to="/read" class="text-sm text-slate-400">← Retour</RouterLink>
      <h1 class="mt-2 text-2xl font-bold">Nouveau texte</h1>
      <p class="mt-1 text-sm text-slate-400">
        Colle ici un texte chinois : paroles, article, transcription de podcast...
      </p>
    </header>

    <form class="flex flex-col gap-3" @submit.prevent="save">
      <div>
        <label class="text-xs uppercase tracking-wide text-slate-400">Titre</label>
        <input
          v-model="title"
          required
          type="text"
          placeholder="Paroles de 蛋堡 - 过程"
          class="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 ring-1 ring-slate-700 focus:outline-none focus:ring-brand-500"
        />
      </div>

      <div>
        <label class="text-xs uppercase tracking-wide text-slate-400">Niveau HSK (optionnel)</label>
        <div class="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            class="chip"
            :class="hskLevel === null ? 'bg-brand-500 text-white' : ''"
            @click="hskLevel = null"
          >
            —
          </button>
          <button
            v-for="n in [1, 2, 3, 4, 5, 6]"
            :key="n"
            type="button"
            class="chip"
            :class="hskLevel === n ? 'bg-brand-500 text-white' : ''"
            @click="hskLevel = n"
          >
            HSK {{ n }}
          </button>
        </div>
      </div>

      <div>
        <label class="text-xs uppercase tracking-wide text-slate-400">Texte chinois</label>
        <textarea
          v-model="content"
          required
          rows="12"
          placeholder="Colle ton texte chinois ici..."
          class="hanzi mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-base ring-1 ring-slate-700 focus:outline-none focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        class="btn-primary"
        :disabled="!title.trim() || !content.trim() || saving"
      >
        <span v-if="saving">Enregistrement...</span>
        <span v-else>Commencer la lecture</span>
      </button>
    </form>
  </section>
</template>
