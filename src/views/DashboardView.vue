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
import { Badge, Button, Card, PageHeader, Progress, Separator, Stat } from '../components/ui';

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
  leeches.value = findLeeches(deck.cards, 8);
  sentenceLeeches.value = await findSentenceLeeches(6);
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

onActivated(refresh);

watch(
  () => route.fullPath,
  (path) => {
    if (path.includes('dashboard')) refresh();
  }
);

watch(
  () => [deck.cards.length, deck.newSeenToday, deck.dueReviewCards.length],
  refresh
);

const heatmapWeeks = computed(() => {
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < heatmap.value.length; i += 7) {
    weeks.push(heatmap.value.slice(i, i + 7));
  }
  return weeks;
});

function heatColor(count: number): string {
  if (count === 0) return 'bg-muted';
  if (count < 5) return 'bg-primary/25';
  if (count < 15) return 'bg-primary/50';
  if (count < 30) return 'bg-primary/75';
  return 'bg-primary';
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
  <section class="mx-auto flex max-w-xl flex-col gap-10 px-6 pt-8">
    <PageHeader
      eyebrow="Accueil"
      title="Ton progrès"
      subtitle="Ton apprentissage, au calme."
    >
      <template #action>
        <RouterLink to="/settings">
          <Button variant="ghost" size="icon" aria-label="Réglages">
            <span class="text-base">⚙</span>
          </Button>
        </RouterLink>
      </template>
    </PageHeader>

    <section v-if="cardsToday" class="space-y-5">
      <div class="flex items-baseline justify-between">
        <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Mots · aujourd'hui
        </h2>
        <Badge v-if="cardsToday.reviewsDone > 0" variant="success">{{ cardsToday.correctRate }}% juste</Badge>
      </div>
      <div class="grid grid-cols-2 gap-6">
        <Stat :value="cardsToday.dueReviewsLeft" label="à revoir" />
        <Stat
          :value="cardsToday.newLeft"
          label="nouveaux"
          :hint="`${deck.newCardsPerDay}/jour`"
        />
      </div>
      <p v-if="cardsToday.reviewsDone > 0" class="text-sm text-muted-foreground">
        {{ cardsToday.reviewsDone }} cartes revues depuis ce matin.
      </p>
      <RouterLink
        v-if="cardsToday.dueReviewsLeft + cardsToday.newLeft > 0"
        to="/review"
      >
        <Button variant="primary" full>Continuer la révision →</Button>
      </RouterLink>
      <p v-else class="text-sm italic text-muted-foreground">Rien à faire pour aujourd'hui.</p>
    </section>

    <Separator />

    <section v-if="sentencesToday" class="space-y-5">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Phrases · aujourd'hui
      </h2>
      <div class="grid grid-cols-2 gap-6">
        <Stat :value="sentencesToday.attempted" label="tentées" />
        <Stat :value="sentencesToday.successRate + '%'" label="réussies" />
      </div>
      <p v-if="sentencesToday.inQueue > 0" class="text-sm text-muted-foreground">
        {{ sentencesToday.inQueue }} phrase{{ sentencesToday.inQueue > 1 ? 's' : '' }} à revoir dans la queue.
      </p>
      <RouterLink to="/review">
        <Button variant="outline" full>Pratiquer les phrases →</Button>
      </RouterLink>
    </section>

    <Separator />

    <section class="space-y-5">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Progression HSK
      </h2>
      <div class="space-y-4">
        <div v-for="lvl in levels" :key="lvl.level" class="space-y-1.5">
          <div class="flex items-baseline justify-between text-sm">
            <span class="font-medium">{{ levelLabel(lvl.level) }}</span>
            <span class="font-editorial text-xs tabular-nums text-muted-foreground">
              {{ lvl.mastered + lvl.learning + lvl.difficult }} / {{ lvl.total }}
            </span>
          </div>
          <Progress
            :segments="[
              { value: barPct(lvl.mastered, lvl.total), class: 'bg-emerald-500/80' },
              { value: barPct(lvl.learning, lvl.total), class: 'bg-amber-500/80' },
              { value: barPct(lvl.difficult, lvl.total), class: 'bg-destructive/80' },
            ]"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span class="flex items-center gap-1.5"><i class="block h-1.5 w-1.5 rounded-full bg-emerald-500/80" />maîtrisés</span>
        <span class="flex items-center gap-1.5"><i class="block h-1.5 w-1.5 rounded-full bg-amber-500/80" />en cours</span>
        <span class="flex items-center gap-1.5"><i class="block h-1.5 w-1.5 rounded-full bg-destructive/80" />difficiles</span>
      </div>
    </section>

    <Separator v-if="leeches.length" />

    <section v-if="leeches.length" class="space-y-4">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Mots à retravailler
      </h2>
      <ul class="divide-y divide-border border-y border-border">
        <li v-for="l in leeches" :key="l.card.id">
          <RouterLink
            :to="{ name: 'card', params: { id: l.card.id } }"
            class="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
          >
            <div class="min-w-0">
              <p class="hanzi text-xl font-medium">{{ l.card.simplified }}</p>
              <p class="text-xs text-muted-foreground">
                {{ l.card.pinyin }} — {{ l.card.definitions[0] }}
              </p>
            </div>
            <Badge variant="destructive">{{ leechReason(l) }}</Badge>
          </RouterLink>
        </li>
      </ul>
    </section>

    <Separator v-if="sentenceLeeches.length" />

    <section v-if="sentenceLeeches.length" class="space-y-4">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Phrases difficiles
      </h2>
      <ul class="divide-y divide-border border-y border-border">
        <li v-for="s in sentenceLeeches" :key="s.zh" class="py-3">
          <p class="hanzi text-lg">{{ s.zh }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ s.fr }}</p>
          <p class="mt-1 text-[11px] uppercase tracking-wide text-destructive/80">
            {{ s.failures }} échec{{ s.failures > 1 ? 's' : '' }} sur {{ s.attempts }} tentative{{ s.attempts > 1 ? 's' : '' }}
          </p>
        </li>
      </ul>
    </section>

    <Separator v-if="heatmap.length" />

    <section v-if="heatmap.length" class="space-y-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          90 derniers jours
        </h2>
        <Badge v-if="streak > 0" variant="primary">🔥 {{ streak }} j</Badge>
      </div>
      <div class="flex gap-[3px] overflow-x-auto pb-1">
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
      <p class="text-[11px] text-muted-foreground">Mots et phrases combinés</p>
    </section>

    <Separator v-if="cardsGlobal" />

    <section v-if="cardsGlobal && sentencesGlobal" class="space-y-6">
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Tout le temps
      </h2>
      <div class="grid grid-cols-2 gap-x-6 gap-y-8">
        <Stat :value="cardsGlobal.totalCards" label="mots au total" />
        <Stat :value="cardsGlobal.retention + '%'" label="rétention mots" />
        <Stat :value="sentencesGlobal.uniqueSeen" label="phrases vues" />
        <Stat :value="sentencesGlobal.successRate + '%'" label="réussite phrases" />
      </div>
    </section>

    <Separator />

    <RouterLink to="/deck" class="text-sm underline underline-offset-4">
      Voir toutes mes cartes →
    </RouterLink>
  </section>
</template>
