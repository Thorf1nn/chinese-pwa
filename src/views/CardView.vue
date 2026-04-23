<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { Badge, Button, Input, PageHeader, Separator, Textarea } from '../components/ui';

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
  <section v-if="card" class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader eyebrow="Fiche" :title="card.simplified">
      <template #action>
        <RouterLink to="/deck">
          <Button variant="ghost" size="sm">retour</Button>
        </RouterLink>
      </template>
    </PageHeader>

    <section class="space-y-3">
      <div class="flex items-baseline gap-3">
        <span class="hanzi text-5xl font-semibold">{{ card.simplified }}</span>
        <span class="font-editorial text-xl text-primary">{{ card.pinyin }}</span>
      </div>
      <ul class="space-y-0.5 text-base">
        <li v-for="(d, i) in card.definitions" :key="i">— {{ d }}</li>
      </ul>
      <div v-if="card.tags.length" class="flex flex-wrap gap-1.5 pt-1">
        <Badge v-for="t in card.tags" :key="t" variant="outline">{{ t }}</Badge>
      </div>
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Phrases d'exemple</h2>

      <div v-if="card.sentences.length" class="space-y-4">
        <div
          v-for="s in card.sentences"
          :key="s.id"
          class="group relative border-l-2 border-border pl-4 pr-8"
        >
          <button
            class="absolute right-0 top-0 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100"
            @click="deck.removeSentence(card!.id, s.id)"
          >
            ✕
          </button>
          <p class="hanzi text-lg">{{ s.zh }}</p>
          <p v-if="s.fr" class="mt-1 text-sm text-muted-foreground">{{ s.fr }}</p>
          <p v-if="s.source" class="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
            — {{ s.source }}
          </p>
        </div>
      </div>
      <p v-else class="text-sm italic text-muted-foreground">Aucune phrase pour l'instant.</p>

      <form class="space-y-3 pt-2" @submit.prevent="addSentence">
        <Textarea v-model="zh" required rows="2" class="hanzi" placeholder="Phrase en chinois" />
        <Input v-model="fr" placeholder="Traduction (optionnel)" />
        <Input v-model="source" placeholder="Source (chanson, podcast…)" />
        <Button type="submit" variant="primary" full :disabled="saving || !zh.trim()">
          Ajouter la phrase
        </Button>
      </form>
    </section>

    <Separator />

    <Button variant="ghost" full class="text-destructive hover:bg-destructive/10" @click="deleteCard">
      Supprimer cette carte
    </Button>
  </section>

  <section v-else class="mx-auto max-w-xl px-6 pt-12 text-center text-sm text-muted-foreground">
    Carte introuvable.
    <RouterLink to="/deck" class="mt-4 block underline underline-offset-4">← retour au deck</RouterLink>
  </section>
</template>
