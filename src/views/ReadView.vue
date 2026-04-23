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
import { Badge, Button, PageHeader, Progress, Sheet, Separator, Stat } from '../components/ui';

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
const sheetOpen = ref(false);

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
  if (!token.isChinese) return 'text-muted-foreground';
  const status = classifyToken(token, cardsMap.value);
  const base = 'cursor-pointer transition rounded px-[1px]';
  const selected = selectedToken.value === token ? 'bg-primary/15' : '';
  if (status === 'mastered') return `${base} ${selected}`;
  if (status === 'learning')
    return `${base} decoration-amber-500/70 underline decoration-dotted decoration-1 underline-offset-[3px] ${selected}`;
  if (status === 'unknown')
    return `${base} decoration-destructive/70 underline decoration-1 underline-offset-[3px] ${selected}`;
  return 'text-muted-foreground';
}

async function onTokenTap(token: ReaderToken) {
  if (!token.isChinese) return;
  selectedToken.value = token;
  selectedEntry.value = token.entry;
  sheetOpen.value = true;
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
  <section class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader :eyebrow="subtitle ?? 'Lecture'" :title="title">
      <template #action>
        <div class="flex items-center gap-2">
          <Button v-if="isUserText" variant="ghost" size="icon" @click="handleDelete" aria-label="Supprimer">
            🗑
          </Button>
          <RouterLink to="/read">
            <Button variant="ghost" size="sm">retour</Button>
          </RouterLink>
        </div>
      </template>
    </PageHeader>

    <section v-if="stats" class="space-y-3">
      <div class="flex items-baseline justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Progression</span>
        <span class="font-editorial text-xs">{{ stats.uniqueWords }} mots uniques</span>
      </div>
      <Progress
        :segments="[
          { value: stats.masteredPct, class: 'bg-emerald-500/80' },
          { value: stats.learningPct, class: 'bg-amber-500/80' },
          { value: stats.unknownPct, class: 'bg-destructive/80' },
        ]"
      />
      <div class="grid grid-cols-3 gap-4 text-center">
        <Stat :value="stats.masteredPct + '%'" label="maîtrisés" />
        <Stat :value="stats.learningPct + '%'" label="en cours" />
        <Stat :value="stats.unknownPct + '%'" label="inconnus" />
      </div>
    </section>

    <Separator />

    <p v-if="loading" class="py-8 text-center text-sm text-muted-foreground">
      Analyse du texte...
    </p>

    <article v-else>
      <p class="mb-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Tape sur un mot pour sa définition
      </p>
      <div class="hanzi text-2xl leading-[2]">
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

    <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span class="flex items-center gap-1.5"><i class="block h-1.5 w-3 rounded-sm bg-emerald-500/60" />maîtrisés</span>
      <span class="flex items-center gap-1.5"><i class="block h-1.5 w-3 rounded-sm bg-amber-500/60" />en cours</span>
      <span class="flex items-center gap-1.5"><i class="block h-1.5 w-3 rounded-sm bg-destructive/60" />inconnus</span>
    </div>

    <Sheet v-model:open="sheetOpen">
      <template v-if="selectedToken">
        <div v-if="selectedLoading" class="text-sm text-muted-foreground">Chargement...</div>
        <div v-else-if="selectedEntry" class="space-y-4">
          <div class="flex items-baseline gap-3">
            <span class="hanzi text-4xl font-semibold">{{ selectedEntry.simplified }}</span>
            <span class="font-editorial text-lg text-primary">{{ selectedEntry.pinyin }}</span>
            <Badge variant="outline" class="ml-auto">CFDICT</Badge>
          </div>
          <ul class="space-y-0.5 text-sm">
            <li v-for="(d, i) in selectedEntry.definitions.slice(0, 5)" :key="i">— {{ d }}</li>
          </ul>
          <Button
            :variant="selectedInDeck ? 'outline' : 'primary'"
            full
            :disabled="selectedInDeck || busyAdd"
            @click="addSelectedToDeck"
          >
            <span v-if="selectedInDeck">✓ Déjà dans ton deck</span>
            <span v-else-if="busyAdd">Ajout...</span>
            <span v-else>+ Ajouter à mon deck</span>
          </Button>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          Aucune entrée pour <span class="hanzi">{{ selectedToken.text }}</span>.
        </p>
      </template>
    </Sheet>
  </section>
</template>
