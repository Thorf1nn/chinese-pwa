<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useDeckStore } from '../stores/deck';

const route = useRoute();
const router = useRouter();
const deck = useDeckStore();

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
});

const card = computed(() => deck.cardById(String(route.params.id)));

const zh = ref('');
const fr = ref('');
const source = ref('');
const saving = ref(false);

async function addSentence() {
  if (!card.value || !zh.value.trim()) return;
  saving.value = true;
  try {
    await deck.addSentence(card.value.id, {
      zh: zh.value.trim(),
      fr: fr.value.trim() || undefined,
      source: source.value.trim() || undefined,
    });
    zh.value = '';
    fr.value = '';
    source.value = '';
  } finally {
    saving.value = false;
  }
}

async function deleteCard() {
  if (!card.value) return;
  if (!confirm(`Supprimer "${card.value.simplified}" de ton deck ?`)) return;
  await deck.removeCard(card.value.id);
  router.replace('/deck');
}
</script>

<template>
  <section v-if="card" class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <RouterLink to="/deck" class="text-sm text-slate-400">← Retour au deck</RouterLink>

    <header class="card text-center">
      <p class="hanzi text-6xl font-semibold">{{ card.simplified }}</p>
      <p class="mt-2 text-xl text-brand-500">{{ card.pinyin }}</p>
      <ul class="mt-3 space-y-1 text-sm text-slate-200">
        <li v-for="(d, i) in card.definitions" :key="i">· {{ d }}</li>
      </ul>
    </header>

    <div class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Phrases d'exemple</h2>

      <div v-if="card.sentences.length" class="mt-3 space-y-2">
        <div
          v-for="s in card.sentences"
          :key="s.id"
          class="group relative rounded-lg bg-slate-800/60 p-3"
        >
          <button
            class="absolute right-2 top-2 text-xs text-slate-500 opacity-0 transition group-hover:opacity-100"
            @click="deck.removeSentence(card!.id, s.id)"
          >
            ✕
          </button>
          <p class="hanzi text-lg">{{ s.zh }}</p>
          <p v-if="s.fr" class="mt-1 text-sm text-slate-300">{{ s.fr }}</p>
          <p v-if="s.source" class="mt-1 text-xs text-slate-500">— {{ s.source }}</p>
        </div>
      </div>
      <p v-else class="mt-2 text-sm text-slate-500">Aucune phrase pour l'instant.</p>

      <form class="mt-4 space-y-2" @submit.prevent="addSentence">
        <textarea
          v-model="zh"
          required
          rows="2"
          placeholder="Phrase en chinois"
          class="hanzi w-full rounded-lg bg-slate-800 px-3 py-2 text-base ring-1 ring-slate-700 focus:outline-none focus:ring-brand-500"
        />
        <input
          v-model="fr"
          type="text"
          placeholder="Traduction (optionnel)"
          class="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-brand-500"
        />
        <input
          v-model="source"
          type="text"
          placeholder="Source (chanson, podcast…)"
          class="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-brand-500"
        />
        <button type="submit" class="btn-primary w-full" :disabled="saving || !zh.trim()">
          Ajouter la phrase
        </button>
      </form>
    </div>

    <button class="btn bg-red-900/40 text-red-200 hover:bg-red-900/60" @click="deleteCard">
      Supprimer cette carte
    </button>
  </section>

  <section v-else class="mx-auto max-w-md px-4 pt-8 text-center text-slate-400">
    Carte introuvable.
    <RouterLink to="/deck" class="block mt-4 text-brand-500">← Retour au deck</RouterLink>
  </section>
</template>
