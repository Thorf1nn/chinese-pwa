<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SentenceItem } from '../lib/sentences';
import { shuffleTokens } from '../lib/sentences';
import { getOrCreateSentenceCard, previewSentenceIntervals, type SentenceRating } from '../lib/sentence-fsrs';
import { db, type DictEntry, type SentenceCard } from '../lib/db';
import { useDeckStore } from '../stores/deck';
import { Badge, Button, Separator } from './ui';

const props = defineProps<{ sentence: SentenceItem }>();
const emit = defineEmits<{
  rated: [SentenceItem, SentenceRating];
  skip: [SentenceItem];
}>();

const deckStore = useDeckStore();

interface Token {
  uid: string;
  value: string;
}

const available = ref<Token[]>([]);
const built = ref<Token[]>([]);
const result = ref<'pending' | 'correct' | 'wrong'>('pending');
const sentencePinyin = ref<string>('');
const fsrsCard = ref<SentenceCard | null>(null);

const selectedToken = ref<string | null>(null);
const selectedEntry = ref<DictEntry | null>(null);
const selectedLoading = ref(false);
const busyAdd = ref(false);

const HAN = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const isChinese = (token: string) => HAN.test(token);

async function computeSentencePinyin() {
  const { pinyin } = await import('pinyin-pro');
  sentencePinyin.value = pinyin(props.sentence.zh, { toneType: 'symbol', type: 'string' });
}

async function loadFsrsCard() {
  fsrsCard.value = await getOrCreateSentenceCard(
    props.sentence.zh,
    props.sentence.fr,
    props.sentence.tokens
  );
}

function reset() {
  const shuffled = shuffleTokens(props.sentence.tokens);
  available.value = shuffled.map((value, i) => ({ uid: `${i}-${value}-${Math.random()}`, value }));
  built.value = [];
  result.value = 'pending';
  sentencePinyin.value = '';
  fsrsCard.value = null;
  selectedToken.value = null;
  selectedEntry.value = null;
  loadFsrsCard();
}

function builtMatchesTarget(): boolean {
  return built.value.map((t) => t.value).join('') === props.sentence.zh;
}

watch(() => props.sentence.zh, reset, { immediate: true });

function pick(t: Token) {
  if (result.value !== 'pending') return;
  available.value = available.value.filter((x) => x.uid !== t.uid);
  built.value.push(t);
}

function unpick(t: Token) {
  if (result.value !== 'pending') return;
  built.value = built.value.filter((x) => x.uid !== t.uid);
  available.value.push(t);
}

function check() {
  if (built.value.length !== props.sentence.tokens.length) return;
  result.value = builtMatchesTarget() ? 'correct' : 'wrong';
  computeSentencePinyin();
}

const intervals = computed(() =>
  fsrsCard.value ? previewSentenceIntervals(fsrsCard.value) : null
);

const allowedRatings = computed<SentenceRating[]>(() =>
  result.value === 'correct' ? [2, 3, 4] : [1, 2]
);

const ratingLabels: Record<SentenceRating, string> = {
  1: 'Encore',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
};

const ratingTones: Record<SentenceRating, string> = {
  1: 'hover:border-destructive/60 hover:bg-destructive/10',
  2: 'hover:border-amber-500/60 hover:bg-amber-500/10',
  3: 'hover:border-emerald-500/60 hover:bg-emerald-500/10',
  4: 'hover:border-sky-500/60 hover:bg-sky-500/10',
};

function rate(r: SentenceRating) {
  emit('rated', props.sentence, r);
}

async function selectTokenInSentence(token: string) {
  if (!isChinese(token)) return;
  if (selectedToken.value === token) {
    selectedToken.value = null;
    selectedEntry.value = null;
    return;
  }
  selectedToken.value = token;
  selectedEntry.value = null;
  selectedLoading.value = true;
  try {
    selectedEntry.value = (await db.dict.where('simplified').equals(token).first()) ?? null;
  } finally {
    selectedLoading.value = false;
  }
}

async function addSelectedToDeck() {
  if (!selectedEntry.value) return;
  busyAdd.value = true;
  try {
    await deckStore.addFromDictEntry(selectedEntry.value, ['sentence']);
  } finally {
    busyAdd.value = false;
  }
}

const selectedInDeck = computed(() => {
  if (!selectedEntry.value) return false;
  return deckStore.cards.some((c) => c.simplified === selectedEntry.value!.simplified);
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Phrase à reformer</p>
      <p class="mt-2 font-serif text-lg italic">« {{ sentence.fr }} »</p>
    </div>

    <div
      class="min-h-[92px] rounded-md border-2 border-dashed p-3 transition-colors"
      :class="{
        'border-border bg-muted/30': result === 'pending',
        'border-emerald-500/60 bg-emerald-500/10': result === 'correct',
        'border-destructive/60 bg-destructive/10': result === 'wrong',
      }"
    >
      <p v-if="!built.length" class="text-center text-sm text-muted-foreground">
        Choisis les mots dans l'ordre ↓
      </p>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="t in built"
          :key="t.uid"
          class="hanzi rounded-md border border-border bg-card px-3 py-2 text-lg active:scale-95"
          :disabled="result !== 'pending'"
          @click="unpick(t)"
        >
          {{ t.value }}
        </button>
      </div>
    </div>

    <div v-if="available.length" class="flex flex-wrap gap-2">
      <button
        v-for="t in available"
        :key="t.uid"
        class="hanzi rounded-md border border-border bg-card px-3 py-2 text-lg transition hover:bg-muted active:scale-95"
        @click="pick(t)"
      >
        {{ t.value }}
      </button>
    </div>

    <Separator v-if="result !== 'pending'" />

    <div v-if="result !== 'pending'">
      <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span v-if="result === 'correct'">Bonne phrase</span>
        <span v-else>La bonne phrase</span>
      </p>
      <div class="mt-3 flex flex-wrap gap-1 text-2xl">
        <button
          v-for="(tok, i) in sentence.tokens"
          :key="i"
          class="hanzi rounded px-1 transition"
          :class="{
            'hover:bg-muted': isChinese(tok),
            'bg-primary/20 underline decoration-primary underline-offset-[3px]':
              selectedToken === tok,
            'cursor-default text-muted-foreground': !isChinese(tok),
          }"
          :disabled="!isChinese(tok)"
          @click="selectTokenInSentence(tok)"
        >
          {{ tok }}
        </button>
      </div>
      <p class="mt-2 font-editorial text-base text-primary">{{ sentencePinyin }}</p>
      <p class="mt-1 text-[11px] text-muted-foreground">
        Tape sur un mot pour sa définition.
      </p>
    </div>

    <div v-if="selectedToken" class="rounded-md border-l-2 border-primary bg-muted/30 p-4">
      <div v-if="selectedLoading" class="text-sm text-muted-foreground">Chargement...</div>
      <div v-else-if="selectedEntry" class="space-y-3">
        <div class="flex items-baseline gap-3">
          <span class="hanzi text-3xl font-semibold">{{ selectedEntry.simplified }}</span>
          <span class="font-editorial text-sm text-primary">{{ selectedEntry.pinyin }}</span>
          <Badge variant="outline" class="ml-auto">CFDICT</Badge>
        </div>
        <ul class="space-y-0.5 text-sm">
          <li v-for="(d, i) in selectedEntry.definitions.slice(0, 5)" :key="i">— {{ d }}</li>
        </ul>
        <Button
          :variant="selectedInDeck ? 'outline' : 'primary'"
          :disabled="selectedInDeck || busyAdd"
          full
          @click="addSelectedToDeck"
        >
          <span v-if="selectedInDeck">✓ Déjà dans ton deck</span>
          <span v-else-if="busyAdd">Ajout...</span>
          <span v-else>+ Ajouter à mon deck</span>
        </Button>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        Aucune entrée dans le dictionnaire pour <span class="hanzi">{{ selectedToken }}</span>.
      </p>
    </div>

    <div v-if="result === 'pending'" class="flex gap-2">
      <Button variant="outline" full @click="emit('skip', sentence)">Passer</Button>
      <Button
        variant="primary"
        full
        :disabled="built.length !== sentence.tokens.length"
        @click="check"
      >
        Valider
      </Button>
    </div>

    <div v-else-if="intervals" class="space-y-3">
      <p class="text-center text-xs text-muted-foreground">
        <span v-if="result === 'correct'">Comment tu l'as sentie ?</span>
        <span v-else>À revoir bientôt</span>
      </p>
      <div class="grid gap-2" :class="allowedRatings.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
        <button
          v-for="r in allowedRatings"
          :key="r"
          class="flex flex-col items-center gap-1 rounded-md border border-border bg-card px-3 py-3 transition active:scale-95"
          :class="ratingTones[r]"
          @click="rate(r)"
        >
          <span class="text-xs font-medium">{{ ratingLabels[r] }}</span>
          <span class="font-editorial text-[11px] tabular-nums text-muted-foreground">{{ intervals[r] }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
