<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { previewIntervals, type ReviewRating } from '../lib/fsrs';
import { buildQuizQuestion, scoreToRating, type QuizQuestion } from '../lib/quiz';
import { loadSentences, pickSentence, type SentenceItem } from '../lib/sentences';
import { logSentenceReview } from '../lib/stats';
import Flashcard from '../components/Flashcard.vue';
import ReviewButtons from '../components/ReviewButtons.vue';
import QuizCard from '../components/QuizCard.vue';
import SentenceBuilder from '../components/SentenceBuilder.vue';

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
const quizRating = ref<ReviewRating | null>(null);
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
    // quota plein, on ignore
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

function requeueAndNext(failed: SentenceItem) {
  sentenceQueue.value.push(failed);
  const next =
    sentenceQueue.value.length > SENTENCE_REQUEUE_OFFSET
      ? sentenceQueue.value.shift() ?? null
      : freshSentence();
  currentSentence.value = next;
}

const current = computed(() => deck.dueCards[0] ?? null);
const intervals = computed(() => (current.value ? previewIntervals(current.value) : null));

const canQuiz = computed(() => deck.cards.length >= 4);
const useClassicFallback = computed(() => mode.value === 'quiz' && !canQuiz.value);

watch(
  [current, mode],
  ([card, m]) => {
    showFullCard.value = false;
    if (m === 'quiz' && card && canQuiz.value) {
      quizQuestion.value = buildQuizQuestion(card, deck.cards);
      quizRating.value = null;
    } else {
      quizQuestion.value = null;
    }
  },
  { immediate: true }
);

async function rate(r: ReviewRating) {
  if (!current.value) return;
  await deck.submitReview(current.value.id, r);
}

async function onQuizDone(correct: 0 | 1 | 2) {
  quizRating.value = scoreToRating(correct);
}

async function nextQuizCard() {
  if (!current.value || !quizRating.value) return;
  await deck.submitReview(current.value.id, quizRating.value);
  quizRating.value = null;
  showFullCard.value = false;
}

function requeueAndNextWithLog(failed: SentenceItem) {
  logSentenceReview({
    zh: failed.zh,
    fr: failed.fr,
    result: 'wrong',
    reviewedAt: Date.now(),
  });
  requeueAndNext(failed);
}

function nextSentenceWithLog(success: boolean, currentZh?: string, currentFr?: string) {
  if (currentZh && currentFr) {
    logSentenceReview({
      zh: currentZh,
      fr: currentFr,
      result: success ? 'correct' : 'skipped',
      reviewedAt: Date.now(),
    });
  }
  nextSentence();
}

function onSentenceCorrect(s: SentenceItem) {
  nextSentenceWithLog(true, s.zh, s.fr);
}

function onSentenceSkip(s: SentenceItem) {
  nextSentenceWithLog(false, s.zh, s.fr);
}
</script>

<template>
  <section class="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pt-4 pb-4">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Révision</h1>
      <div class="flex items-center gap-2 text-xs">
        <span class="chip bg-sky-900 text-sky-100">{{ deck.dueReviewCards.length }} révisions</span>
        <span class="chip bg-emerald-900 text-emerald-100">
          {{ deck.queuedNewCards.length }} nouv. ({{ deck.newLeftToday }}/{{ deck.newCardsPerDay }})
        </span>
      </div>
    </header>

    <div class="flex gap-2">
      <button
        class="btn flex-1 text-sm"
        :class="mode === 'quiz' ? 'bg-brand-500 text-white' : 'btn-ghost'"
        @click="mode = 'quiz'"
      >
        🧠 Quiz
      </button>
      <button
        class="btn flex-1 text-sm"
        :class="mode === 'sentences' ? 'bg-brand-500 text-white' : 'btn-ghost'"
        @click="mode = 'sentences'"
      >
        🧩 Phrases
      </button>
    </div>

    <p v-if="useClassicFallback && current" class="rounded-md bg-amber-900/30 p-2 text-center text-xs text-amber-200">
      Quiz indisponible (deck &lt; 4 cartes) — mode classique utilisé.
    </p>

    <template v-if="current && useClassicFallback && intervals">
      <Flashcard ref="flashcard" :card="current" />
      <div>
        <ReviewButtons
          v-if="flashcard?.revealed"
          :intervals="intervals"
          @rate="rate"
        />
        <p v-else class="text-center text-xs text-slate-500">
          Tape "Afficher la réponse" pour évaluer.
        </p>
      </div>
    </template>

    <template v-else-if="current && mode === 'quiz' && quizQuestion">
      <QuizCard :question="quizQuestion" @done="onQuizDone" />
      <div v-if="quizRating" class="flex flex-col gap-2">
        <button
          v-if="!showFullCard && current.sentences.length"
          class="btn-ghost text-sm"
          @click="showFullCard = true"
        >
          👁 Voir la carte complète
        </button>
        <div v-if="showFullCard" class="card text-left">
          <p class="text-xs uppercase tracking-wide text-slate-500">Exemples</p>
          <div
            v-for="s in current.sentences"
            :key="s.id"
            class="mt-2 rounded bg-slate-800/60 p-2 text-sm"
          >
            <p class="hanzi">{{ s.zh }}</p>
            <p v-if="s.fr" class="text-slate-300">{{ s.fr }}</p>
            <p v-if="s.source" class="text-xs text-slate-500">— {{ s.source }}</p>
          </div>
        </div>
        <button class="btn-primary" @click="nextQuizCard">Suivant →</button>
      </div>
    </template>

    <template v-else-if="mode === 'sentences'">
      <SentenceBuilder
        v-if="currentSentence"
        :sentence="currentSentence"
        @next="onSentenceCorrect"
        @failed="requeueAndNextWithLog"
        @skip="onSentenceSkip"
      />
      <div v-else class="flex flex-1 items-center justify-center text-slate-500">
        {{ sentencesLoading ? 'Chargement des phrases…' : 'Aucune phrase disponible' }}
      </div>
    </template>

    <div v-else-if="!deck.loaded" class="flex flex-1 items-center justify-center text-slate-500">
      Chargement…
    </div>

    <div
      v-else-if="deck.totalCount === 0"
      class="flex flex-1 flex-col items-center justify-center text-center"
    >
      <p class="text-4xl">📖</p>
      <p class="mt-4 text-lg font-semibold">Ton deck est vide</p>
      <p class="mt-1 text-sm text-slate-400">
        Commence avec un deck HSK ou cherche des mots à la main.
      </p>
      <div class="mt-6 flex gap-2">
        <RouterLink to="/decks" class="btn-primary">Importer HSK</RouterLink>
        <RouterLink to="/search" class="btn-ghost">Chercher</RouterLink>
      </div>
    </div>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center text-center"
    >
      <p class="text-5xl">🎉</p>
      <p class="mt-4 text-lg font-semibold">Tout est à jour !</p>
      <p v-if="deck.newCount > 0 && deck.newLeftToday === 0" class="mt-1 text-sm text-slate-400">
        Tu as vu tes {{ deck.newCardsPerDay }} nouveaux mots du jour.
        <span class="block mt-1">{{ deck.newCount }} nouveaux en attente pour demain.</span>
      </p>
      <p v-else class="mt-1 text-sm text-slate-400">
        Rien à réviser pour l'instant. Reviens plus tard ou ajoute des mots.
      </p>
      <RouterLink to="/deck" class="btn-ghost mt-6">Voir mon deck</RouterLink>
    </div>
  </section>
</template>
