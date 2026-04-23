<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  classifyToken,
  computeReadStats,
  deleteUserText,
  loadPreloadTexts,
  segmentText,
  updateLastRead,
  type ReaderToken,
  type ReadStats,
} from '../lib/reader';
import { db, type DictEntry, type UserText } from '../lib/db';
import { useDeckStore } from '../stores/deck';

const route = useRoute();
const router = useRouter();
const deck = useDeckStore();

const loading = ref(true);
const title = ref('');
const subtitle = ref<string | null>(null);
const tokens = ref<ReaderToken[]>([]);
const isUserText = ref(false);
const stats = ref<ReadStats | null>(null);

const selectedToken = ref<ReaderToken | null>(null);
const selectedLoading = ref(false);
const selectedEntry = ref<DictEntry | null>(null);
const busyAdd = ref(false);

async function loadText(id: string) {
  loading.value = true;
  tokens.value = [];
  selectedToken.value = null;
  selectedEntry.value = null;

  let rawContent = '';
  let titleVal = '';
  let subtitleVal: string | null = null;
  let isUser = false;

  if (id.startsWith('preload-')) {
    const preloads = await loadPreloadTexts();
    const found = preloads.find((t) => t.id === id);
    if (!found) {
      router.replace('/read');
      return;
    }
    rawContent = found.content;
    titleVal = found.title;
    subtitleVal = found.subtitle ?? null;
  } else {
    const user: UserText | undefined = await db.userTexts.get(id);
    if (!user) {
      router.replace('/read');
      return;
    }
    rawContent = user.content;
    titleVal = user.title;
    subtitleVal = user.subtitle ?? null;
    isUser = true;
    await updateLastRead(id);
  }

  title.value = titleVal;
  subtitle.value = subtitleVal;
  isUserText.value = isUser;

  tokens.value = await segmentText(rawContent);

  if (!deck.loaded) await deck.loadAll();
  stats.value = computeReadStats(tokens.value, deck.cards);

  loading.value = false;
}

onMounted(() => loadText(String(route.params.id)));

watch(
  () => route.params.id,
  (id) => {
    if (id) loadText(String(id));
  }
);

const cardsMap = computed(() => {
  const m = new Map<string, import('../lib/db').Card>();
  for (const c of deck.cards) m.set(c.simplified, c);
  return m;
});

function tokenClass(token: ReaderToken): string {
  if (!token.isChinese) return 'text-slate-400';
  const status = classifyToken(token, cardsMap.value);
  const base = 'cursor-pointer transition rounded px-[1px]';
  const selected = selectedToken.value === token ? 'bg-brand-500/40' : '';
  if (status === 'mastered') return `${base} text-slate-100 ${selected}`;
  if (status === 'learning')
    return `${base} text-amber-300 decoration-amber-500/60 underline decoration-dotted decoration-1 underline-offset-[3px] ${selected}`;
  if (status === 'unknown')
    return `${base} text-rose-300 decoration-rose-500 underline decoration-1 underline-offset-[3px] ${selected}`;
  return 'text-slate-500';
}

async function onTokenTap(token: ReaderToken) {
  if (!token.isChinese) return;
  if (selectedToken.value === token) {
    selectedToken.value = null;
    selectedEntry.value = null;
    return;
  }
  selectedToken.value = token;
  selectedEntry.value = token.entry;
  if (!selectedEntry.value) {
    selectedLoading.value = true;
    try {
      selectedEntry.value =
        (await db.dict.where('simplified').equals(token.text).first()) ?? null;
    } finally {
      selectedLoading.value = false;
    }
  }
}

async function addSelectedToDeck() {
  if (!selectedEntry.value) return;
  busyAdd.value = true;
  try {
    await deck.addFromDictEntry(selectedEntry.value, ['reading']);
    stats.value = computeReadStats(tokens.value, deck.cards);
  } finally {
    busyAdd.value = false;
  }
}

const selectedInDeck = computed(() => {
  if (!selectedEntry.value) return false;
  return deck.cards.some((c) => c.simplified === selectedEntry.value!.simplified);
});

async function handleDelete() {
  if (!isUserText.value) return;
  if (!confirm(`Supprimer le texte « ${title.value} » ?`)) return;
  await deleteUserText(String(route.params.id));
  router.replace('/read');
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <RouterLink to="/read" class="text-sm text-slate-400">← Textes</RouterLink>
        <h1 class="hanzi mt-1 text-2xl font-bold">{{ title }}</h1>
        <p v-if="subtitle" class="text-sm text-slate-400">{{ subtitle }}</p>
      </div>
      <button
        v-if="isUserText"
        class="shrink-0 rounded-lg p-2 text-sm text-red-300 hover:bg-red-900/30"
        @click="handleDelete"
        title="Supprimer"
      >
        🗑
      </button>
    </header>

    <article v-if="stats" class="card">
      <h2 class="text-xs uppercase tracking-wide text-slate-400">Progression</h2>
      <div class="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="bg-emerald-500" :style="{ width: stats.masteredPct + '%' }" />
        <div class="bg-amber-500" :style="{ width: stats.learningPct + '%' }" />
        <div class="bg-rose-500" :style="{ width: stats.unknownPct + '%' }" />
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p class="text-lg font-bold text-emerald-400">{{ stats.masteredPct }}%</p>
          <p class="text-slate-400">maîtrisés</p>
        </div>
        <div>
          <p class="text-lg font-bold text-amber-400">{{ stats.learningPct }}%</p>
          <p class="text-slate-400">en cours</p>
        </div>
        <div>
          <p class="text-lg font-bold text-rose-400">{{ stats.unknownPct }}%</p>
          <p class="text-slate-400">inconnus</p>
        </div>
      </div>
      <p class="mt-2 text-center text-xs text-slate-500">
        {{ stats.uniqueWords }} mots uniques dans le texte
      </p>
    </article>

    <div v-if="loading" class="card text-center text-slate-400">Analyse du texte...</div>

    <article v-else class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500">
        Tape sur un mot pour la définition
      </p>
      <div class="hanzi mt-3 text-xl leading-loose">
        <template v-for="(tok, i) in tokens" :key="i">
          <span v-if="tok.text === '\n'"><br /><br /></span>
          <button
            v-else-if="tok.isChinese"
            :class="tokenClass(tok)"
            @click="onTokenTap(tok)"
          >
            {{ tok.text }}
          </button>
          <span v-else :class="tokenClass(tok)">{{ tok.text }}</span>
        </template>
      </div>
    </article>

    <article v-if="selectedToken" class="card border-l-4 border-brand-500">
      <div v-if="selectedLoading" class="text-sm text-slate-400">Chargement...</div>
      <div v-else-if="selectedEntry">
        <div class="flex items-baseline gap-2">
          <span class="hanzi text-3xl font-semibold">{{ selectedEntry.simplified }}</span>
          <span class="text-sm text-brand-500">{{ selectedEntry.pinyin }}</span>
        </div>
        <ul class="mt-2 space-y-0.5 text-sm text-slate-200">
          <li v-for="(d, i) in selectedEntry.definitions.slice(0, 5)" :key="i">· {{ d }}</li>
        </ul>
        <button
          class="btn mt-3 w-full"
          :class="selectedInDeck ? 'bg-emerald-700 text-white' : 'btn-primary'"
          :disabled="selectedInDeck || busyAdd"
          @click="addSelectedToDeck"
        >
          <span v-if="selectedInDeck">✓ Déjà dans ton deck</span>
          <span v-else-if="busyAdd">Ajout...</span>
          <span v-else>+ Ajouter à mon deck</span>
        </button>
      </div>
      <div v-else class="text-sm text-slate-400">
        Aucune entrée pour <span class="hanzi">{{ selectedToken.text }}</span>.
      </div>
    </article>
  </section>
</template>
