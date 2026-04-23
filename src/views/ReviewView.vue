<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { previewIntervals, type ReviewRating } from '../lib/fsrs';
import { buildQuizQuestion, type QuizQuestion } from '../lib/quiz';
import { loadSentences, pickSentence, type SentenceItem } from '../lib/sentences';
import { submitSentenceReview, type SentenceRating } from '../lib/sentence-fsrs';
import Flashcard from '../components/Flashcard.vue';
import ReviewButtons from '../components/ReviewButtons.vue';
import QuizCard from '../components/QuizCard.vue';
import SentenceBuilder from '../components/SentenceBuilder.vue';
import { Badge, Button, Card, PageHeader, Separator, Tabs } from '../components/ui';

type Mode = 'quiz' | 'sentences';
const MODE_KEY = 'chinese-pwa:reviewMode';

function readMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === 'quiz' || stored === 'sentences') return stored;
  return 'quiz';
}

const deck = useDeckStore();
const flashcard = ref<InstanceType<typeof Flashcard> | null>(null);
const mode = ref<Mode>(readMode());
const quizQuestion = ref<QuizQuestion | null>(null);
const quizDone = ref(false);
const quizCorrectCount = ref<0 | 1 | 2>(0);
const showFullCard = ref(false);
const sentencePool = ref<SentenceItem[] | null>(null);
const SENTENCE_QUEUE_KEY = 'chinese-pwa:sentenceQueue';
const sentenceQueue = ref<SentenceItem[]>(loadSentenceQueue());
const currentSentence = ref<SentenceItem | null>(null);
const sentencesLoading = ref(false);
const SENTENCE_REQUEUE_OFFSET = 4;

function loadSentenceQueue(): SentenceItem[] {
  try {
    const raw = localStorage.getItem(SENTENCE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) => s && typeof s.zh === 'string' && typeof s.fr === 'string' && Array.isArray(s.tokens)
    );
  } catch {
    return [];
  }
}

function saveSentenceQueue() {
  try {
    localStorage.setItem(SENTENCE_QUEUE_KEY, JSON.stringify(sentenceQueue.value));
  } catch {
    // quota
  }
}

watch(sentenceQueue, saveSentenceQueue, { deep: true });

watch(mode, (m) => {
  localStorage.setItem(MODE_KEY, m);
  if (m === 'sentences') ensureSentences();
});

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
  if (mode.value === 'sentences') ensureSentences();
});

async function ensureSentences() {
  if (sentencePool.value || sentencesLoading.value) return;
  sentencesLoading.value = true;
  try {
    sentencePool.value = await loadSentences();
    nextSentence();
  } finally {
    sentencesLoading.value = false;
  }
}

function freshSentence(): SentenceItem | null {
  if (!sentencePool.value) return null;
  const exclude = new Set(sentenceQueue.value.map((s) => s.zh));
  for (let attempt = 0; attempt < 20; attempt++) {
    const s = pickSentence(sentencePool.value, { cards: deck.cards });
    if (!s) return null;
    if (!exclude.has(s.zh) && s.zh !== currentSentence.value?.zh) return s;
  }
  return pickSentence(sentencePool.value, { cards: deck.cards });
}

function nextSentence() {
  if (sentenceQueue.value.length > 0) {
    currentSentence.value = sentenceQueue.value.shift() ?? null;
    return;
  }
  currentSentence.value = freshSentence();
}

const lockedCardId = ref<string | null>(null);
const current = computed(() => {
  if (lockedCardId.value) {
    const locked = deck.cards.find((c) => c.id === lockedCardId.value);
    if (locked) return locked;
  }
  return deck.dueCards[0] ?? null;
});
const intervals = computed(() => (current.value ? previewIntervals(current.value) : null));

const canQuiz = computed(() => deck.cards.length >= 4);
const useClassicFallback = computed(() => mode.value === 'quiz' && !canQuiz.value);

watch(
  () => current.value?.id,
  (id) => {
    showFullCard.value = false;
    quizDone.value = false;
    quizCorrectCount.value = 0;
    lockedCardId.value = id ?? null;
    if (mode.value === 'quiz' && current.value && canQuiz.value) {
      quizQuestion.value = buildQuizQuestion(current.value, deck.cards);
    } else {
      quizQuestion.value = null;
    }
  },
  { immediate: true }
);

watch(mode, (m) => {
  if (m !== 'quiz') lockedCardId.value = null;
});

async function rate(r: ReviewRating) {
  if (!current.value) return;
  const id = current.value.id;
  await deck.submitReview(id, r);
  lockedCardId.value = null;
}

function onQuizDone(correct: 0 | 1 | 2) {
  quizCorrectCount.value = correct;
  quizDone.value = true;
}

async function rateFromQuiz(r: ReviewRating) {
  if (!current.value) return;
  const id = current.value.id;
  await deck.submitReview(id, r);
  lockedCardId.value = null;
  quizDone.value = false;
  showFullCard.value = false;
}

const quizAllowedRatings = computed<ReviewRating[]>(() =>
  quizCorrectCount.value === 2 ? [2, 3, 4] : [1, 2]
);

const ratingLabels: Record<ReviewRating, string> = {
  1: 'Encore',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
};

const ratingTones: Record<ReviewRating, string> = {
  1: 'hover:border-destructive/60 hover:bg-destructive/10',
  2: 'hover:border-amber-500/60 hover:bg-amber-500/10',
  3: 'hover:border-emerald-500/60 hover:bg-emerald-500/10',
  4: 'hover:border-sky-500/60 hover:bg-sky-500/10',
};

async function onSentenceRated(s: SentenceItem, rating: SentenceRating) {
  await submitSentenceReview(s.zh, s.fr, s.tokens, rating);
  if (rating === 1) {
    sentenceQueue.value.push(s);
    const next =
      sentenceQueue.value.length > SENTENCE_REQUEUE_OFFSET
        ? sentenceQueue.value.shift() ?? null
        : freshSentence();
    currentSentence.value = next;
  } else {
    nextSentence();
  }
}

function onSentenceSkip() {
  nextSentence();
}

const stepCount = computed(() =>
  mode.value === 'quiz'
    ? deck.dueReviewCards.length + deck.queuedNewCards.length
    : null
);
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-8 px-6 pt-8">
    <PageHeader
      eyebrow="Révision"
      :title="mode === 'quiz' ? 'Quiz' : 'Phrases'"
      :subtitle="mode === 'quiz' ? 'Reconnais le mot dans son contexte.' : 'Remets les mots dans le bon ordre.'"
    >
      <template #action>
        <RouterLink to="/dashboard">
          <Button variant="ghost" size="sm">retour</Button>
        </RouterLink>
      </template>
    </PageHeader>

    <div class="flex items-baseline justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      <span v-if="mode === 'quiz'">
        <span class="font-editorial text-sm">{{ deck.dueReviewCards.length }}</span> à revoir ·
        <span class="font-editorial text-sm">{{ deck.queuedNewCards.length }}</span> nouveaux ({{ deck.newLeftToday }}/{{ deck.newCardsPerDay }})
      </span>
      <span v-else>
        <span class="font-editorial text-sm">{{ sentenceQueue.length }}</span> en queue
      </span>
    </div>

    <Tabs
      v-model="mode"
      :items="[
        { value: 'quiz', label: 'Quiz' },
        { value: 'sentences', label: 'Phrases' },
      ]"
    />

    <p v-if="useClassicFallback && current" class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs text-amber-700 dark:text-amber-400">
      Quiz indisponible (deck &lt; 4 cartes) — mode classique utilisé.
    </p>

    <template v-if="current && useClassicFallback && intervals">
      <Flashcard ref="flashcard" :card="current" />
      <ReviewButtons
        v-if="flashcard?.revealed"
        :intervals="intervals"
        @rate="rate"
      />
      <p v-else class="text-center text-xs text-muted-foreground">
        Tape "Afficher la réponse" pour évaluer.
      </p>
    </template>

    <template v-else-if="current && mode === 'quiz' && quizQuestion">
      <QuizCard :question="quizQuestion" @done="onQuizDone" />
      <div v-if="quizDone && intervals" class="space-y-3">
        <p class="text-center text-xs">
          <span v-if="quizCorrectCount === 2" class="text-emerald-700 dark:text-emerald-400">2/2 · comment tu t'en es sorti ?</span>
          <span v-else-if="quizCorrectCount === 1" class="text-amber-700 dark:text-amber-400">1/2 · à revoir bientôt</span>
          <span v-else class="text-destructive">0/2 · on recommence</span>
        </p>
        <div class="grid gap-2" :class="quizAllowedRatings.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
          <button
            v-for="r in quizAllowedRatings"
            :key="r"
            class="flex flex-col items-center gap-1 rounded-md border border-border bg-card px-3 py-3 transition active:scale-95"
            :class="ratingTones[r]"
            @click="rateFromQuiz(r)"
          >
            <span class="text-xs font-medium">{{ ratingLabels[r] }}</span>
            <span class="font-editorial text-[11px] tabular-nums text-muted-foreground">{{ intervals[r] }}</span>
          </button>
        </div>
        <Button
          v-if="!showFullCard && current.sentences.length"
          variant="ghost"
          size="sm"
          full
          @click="showFullCard = true"
        >
          Voir les exemples
        </Button>
        <div v-if="showFullCard && current.sentences.length" class="border-l-2 border-primary/40 pl-4">
          <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Exemples</p>
          <div
            v-for="s in current.sentences"
            :key="s.id"
            class="mt-3 space-y-1"
          >
            <p class="hanzi text-base">{{ s.zh }}</p>
            <p v-if="s.fr" class="text-sm text-muted-foreground">{{ s.fr }}</p>
            <p v-if="s.source" class="text-[11px] uppercase tracking-wide text-muted-foreground/70">
              — {{ s.source }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="mode === 'sentences'">
      <SentenceBuilder
        v-if="currentSentence"
        :sentence="currentSentence"
        @rated="onSentenceRated"
        @skip="onSentenceSkip"
      />
      <p v-else class="py-12 text-center text-sm text-muted-foreground">
        {{ sentencesLoading ? 'Chargement des phrases…' : 'Aucune phrase disponible' }}
      </p>
    </template>

    <div
      v-else-if="!deck.loaded"
      class="py-12 text-center text-sm text-muted-foreground"
    >
      Chargement…
    </div>

    <div
      v-else-if="deck.totalCount === 0"
      class="flex flex-col items-center gap-4 py-12 text-center"
    >
      <p class="font-serif text-2xl italic text-muted-foreground">Ton deck est vide</p>
      <p class="text-sm text-muted-foreground">
        Commence avec un deck HSK ou cherche des mots.
      </p>
      <div class="flex gap-3 pt-2">
        <RouterLink to="/decks"><Button variant="primary">Importer HSK</Button></RouterLink>
        <RouterLink to="/search"><Button variant="outline">Chercher</Button></RouterLink>
      </div>
    </div>

    <div
      v-else
      class="flex flex-col items-center gap-4 py-12 text-center"
    >
      <p class="font-serif text-2xl italic">Tout est à jour</p>
      <p v-if="deck.newCount > 0 && deck.newLeftToday === 0" class="max-w-xs text-sm text-muted-foreground">
        Tu as vu tes {{ deck.newCardsPerDay }} nouveaux mots du jour.
        <span class="block">{{ deck.newCount }} nouveaux en attente pour demain.</span>
      </p>
      <p v-else class="max-w-xs text-sm text-muted-foreground">
        Rien à réviser pour l'instant. Reviens plus tard ou ajoute des mots.
      </p>
      <RouterLink to="/deck" class="pt-2">
        <Button variant="outline">Voir mon deck</Button>
      </RouterLink>
    </div>
  </section>
</template>
