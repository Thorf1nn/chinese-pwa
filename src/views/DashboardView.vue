<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useDeckStore } from '../stores/deck';
import { HSK_LEVELS, useHskStore } from '../stores/hsk';
import {
  buildHeatmap,
  computeLevelProgress,
  computeStreak,
  findLeeches,
  findSentenceLeeches,
  getCardsGlobalStats,
  getCardsTodaySummary,
  getSentencesGlobalStats,
  getSentencesTodaySummary,
  type CardsGlobalStats,
  type CardsTodaySummary,
  type HeatmapDay,
  type LeechEntry,
  type LevelProgress,
  type SentenceLeech,
  type SentencesGlobalStats,
  type SentencesTodaySummary,
} from '../lib/stats';

const SENTENCE_QUEUE_KEY = 'chinese-pwa:sentenceQueue';

const deck = useDeckStore();
const hsk = useHskStore();

const cardsToday = ref<CardsTodaySummary | null>(null);
const sentencesToday = ref<SentencesTodaySummary | null>(null);
const cardsGlobal = ref<CardsGlobalStats | null>(null);
const sentencesGlobal = ref<SentencesGlobalStats | null>(null);
const levels = ref<LevelProgress[]>([]);
const leeches = ref<LeechEntry[]>([]);
const sentenceLeeches = ref<SentenceLeech[]>([]);
const heatmap = ref<HeatmapDay[]>([]);
const streak = computed(() => computeStreak(heatmap.value));

function readSentenceQueueLength(): number {
  try {
    const raw = localStorage.getItem(SENTENCE_QUEUE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

async function refresh() {
  cardsToday.value = await getCardsTodaySummary(deck.dueReviewCards.length, deck.newLeftToday);
  sentencesToday.value = await getSentencesTodaySummary(readSentenceQueueLength());
  const levelInput = HSK_LEVELS.map((lvl) => ({ id: lvl.id, total: hsk.words(lvl.id).length }));
  levels.value = computeLevelProgress(deck.cards, levelInput);
  leeches.value = findLeeches(deck.cards, 10);
  sentenceLeeches.value = await findSentenceLeeches(10);
  heatmap.value = await buildHeatmap(90);
  cardsGlobal.value = await getCardsGlobalStats(deck.cards);
  sentencesGlobal.value = await getSentencesGlobalStats();
}

const route = useRoute();

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
  await hsk.ensureLoaded();
  await refresh();
});

onActivated(() => {
  refresh();
});

watch(
  () => route.fullPath,
  (path) => {
    if (path.includes('dashboard')) refresh();
  }
);

watch(
  () => [deck.cards.length, deck.newSeenToday, deck.dueReviewCards.length],
  () => {
    refresh();
  }
);

const heatmapWeeks = computed(() => {
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < heatmap.value.length; i += 7) {
    weeks.push(heatmap.value.slice(i, i + 7));
  }
  return weeks;
});

function heatColor(count: number): string {
  if (count === 0) return 'bg-slate-800';
  if (count < 5) return 'bg-emerald-900';
  if (count < 15) return 'bg-emerald-700';
  if (count < 30) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

function levelLabel(id: string): string {
  return HSK_LEVELS.find((l) => l.id === id)?.label ?? id;
}

function barPct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function leechReason(r: LeechEntry): string {
  if (r.reason === 'lapses') return `${r.card.lapses} échecs`;
  if (r.reason === 'difficulty') return 'difficulté haute';
  return `${r.card.lapses} échecs · difficile`;
}
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header>
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="mt-1 text-sm text-slate-400">Ton progrès en un coup d'œil.</p>
    </header>

    <article v-if="cardsToday" class="card border-l-4 border-sky-500">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-sky-400">📚 Mots — Aujourd'hui</h2>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p class="text-3xl font-bold text-sky-400">{{ cardsToday.dueReviewsLeft }}</p>
          <p class="text-xs text-slate-400">à revoir</p>
        </div>
        <div>
          <p class="text-3xl font-bold text-emerald-400">{{ cardsToday.newLeft }}</p>
          <p class="text-xs text-slate-400">nouveaux ({{ deck.newCardsPerDay }}/jour)</p>
        </div>
      </div>
      <div v-if="cardsToday.reviewsDone > 0" class="mt-3 border-t border-slate-800 pt-3 text-sm text-slate-300">
        {{ cardsToday.reviewsDone }} cartes revues · <span class="text-emerald-400">{{ cardsToday.correctRate }}% juste</span>
      </div>
      <RouterLink
        v-if="cardsToday.dueReviewsLeft + cardsToday.newLeft > 0"
        to="/review"
        class="btn-primary mt-4 w-full"
      >
        Continuer la révision →
      </RouterLink>
      <p v-else class="mt-4 text-center text-xs text-slate-500">🎉 Rien à faire pour aujourd'hui.</p>
    </article>

    <article v-if="sentencesToday" class="card border-l-4 border-purple-500">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-purple-400">🧩 Phrases — Aujourd'hui</h2>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p class="text-3xl font-bold text-purple-400">{{ sentencesToday.attempted }}</p>
          <p class="text-xs text-slate-400">tentées</p>
        </div>
        <div>
          <p class="text-3xl font-bold text-emerald-400">{{ sentencesToday.successRate }}%</p>
          <p class="text-xs text-slate-400">réussies</p>
        </div>
      </div>
      <div v-if="sentencesToday.inQueue > 0" class="mt-3 border-t border-slate-800 pt-3 text-sm text-slate-300">
        {{ sentencesToday.inQueue }} phrase(s) à revoir dans la queue
      </div>
      <RouterLink to="/review" class="btn-ghost mt-4 w-full">
        Pratiquer les phrases →
      </RouterLink>
    </article>

    <article class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Progression HSK</h2>
      <div class="mt-3 space-y-3">
        <div v-for="lvl in levels" :key="lvl.level">
          <div class="flex items-baseline justify-between text-sm">
            <span class="font-semibold">{{ levelLabel(lvl.level) }}</span>
            <span class="text-xs text-slate-400">
              {{ lvl.mastered + lvl.learning + lvl.difficult }} / {{ lvl.total }}
            </span>
          </div>
          <div class="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-800">
            <div class="bg-emerald-500" :style="{ width: barPct(lvl.mastered, lvl.total) + '%' }" />
            <div class="bg-amber-500" :style="{ width: barPct(lvl.learning, lvl.total) + '%' }" />
            <div class="bg-red-500" :style="{ width: barPct(lvl.difficult, lvl.total) + '%' }" />
          </div>
        </div>
      </div>
      <div class="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span class="flex items-center gap-1"><i class="inline-block h-2 w-2 rounded-full bg-emerald-500" />maîtrisés</span>
        <span class="flex items-center gap-1"><i class="inline-block h-2 w-2 rounded-full bg-amber-500" />en cours</span>
        <span class="flex items-center gap-1"><i class="inline-block h-2 w-2 rounded-full bg-red-500" />difficiles</span>
      </div>
    </article>

    <article v-if="leeches.length" class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">📚 Mots à retravailler 🔴</h2>
      <ul class="mt-3 space-y-2">
        <li v-for="l in leeches" :key="l.card.id">
          <RouterLink
            :to="{ name: 'card', params: { id: l.card.id } }"
            class="flex items-center justify-between rounded-lg bg-slate-800/60 p-2 hover:bg-slate-800"
          >
            <div class="min-w-0">
              <p class="hanzi text-lg">{{ l.card.simplified }}</p>
              <p class="text-xs text-slate-400">
                <span class="text-brand-500">{{ l.card.pinyin }}</span>
                · {{ l.card.definitions[0] }}
              </p>
            </div>
            <span class="chip bg-red-900 text-red-200">{{ leechReason(l) }}</span>
          </RouterLink>
        </li>
      </ul>
    </article>

    <article v-if="sentenceLeeches.length" class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">🧩 Phrases difficiles 🔴</h2>
      <ul class="mt-3 space-y-2">
        <li
          v-for="s in sentenceLeeches"
          :key="s.zh"
          class="rounded-lg bg-slate-800/60 p-2"
        >
          <p class="hanzi text-lg">{{ s.zh }}</p>
          <p class="text-xs text-slate-300">{{ s.fr }}</p>
          <p class="mt-1 text-xs text-red-300">
            {{ s.failures }} échec(s) sur {{ s.attempts }} tentative(s)
          </p>
        </li>
      </ul>
    </article>

    <article v-if="heatmap.length" class="card">
      <div class="flex items-baseline justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">90 derniers jours</h2>
        <span v-if="streak > 0" class="chip bg-orange-900 text-orange-200">🔥 {{ streak }}j d'affilée</span>
      </div>
      <div class="mt-3 flex gap-[3px] overflow-x-auto pb-1">
        <div v-for="(week, wi) in heatmapWeeks" :key="wi" class="flex flex-col gap-[3px]">
          <div
            v-for="(day, di) in week"
            :key="di"
            class="h-3 w-3 rounded-sm"
            :class="heatColor(day.count)"
            :title="`${day.date} · ${day.cards} mot(s) · ${day.sentences} phrase(s)`"
          />
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500">Mots et phrases combinés</p>
    </article>

    <article v-if="cardsGlobal" class="card border-l-4 border-sky-500">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-sky-400">📚 Mots — Total</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="text-2xl font-bold">{{ cardsGlobal.totalCards }}</p>
          <p class="text-xs text-slate-400">cartes</p>
        </div>
        <div>
          <p class="text-2xl font-bold">{{ cardsGlobal.totalReviews }}</p>
          <p class="text-xs text-slate-400">révisions</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-emerald-400">{{ cardsGlobal.retention }}%</p>
          <p class="text-xs text-slate-400">rétention</p>
        </div>
        <div>
          <p class="text-2xl font-bold">+{{ cardsGlobal.addedThisWeek }}</p>
          <p class="text-xs text-slate-400">cette semaine</p>
        </div>
      </div>
    </article>

    <article v-if="sentencesGlobal" class="card border-l-4 border-purple-500">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-purple-400">🧩 Phrases — Total</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="text-2xl font-bold">{{ sentencesGlobal.uniqueSeen }}</p>
          <p class="text-xs text-slate-400">phrases uniques vues</p>
        </div>
        <div>
          <p class="text-2xl font-bold">{{ sentencesGlobal.totalAttempts }}</p>
          <p class="text-xs text-slate-400">tentatives totales</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-emerald-400">{{ sentencesGlobal.successRate }}%</p>
          <p class="text-xs text-slate-400">de réussite</p>
        </div>
      </div>
    </article>

    <RouterLink to="/deck" class="btn-ghost">Voir toutes mes cartes →</RouterLink>
  </section>
</template>
