<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SentenceItem } from '../lib/sentences';
import { shuffleTokens } from '../lib/sentences';
import { getOrCreateSentenceCard, previewSentenceIntervals, type SentenceRating } from '../lib/sentence-fsrs';
import type { SentenceCard } from '../lib/db';

const props = defineProps<{ sentence: SentenceItem }>();
const emit = defineEmits<{
  rated: [SentenceItem, SentenceRating];
  skip: [SentenceItem];
}>();

interface Token {
  uid: string;
  value: string;
}

const available = ref<Token[]>([]);
const built = ref<Token[]>([]);
const result = ref<'pending' | 'correct' | 'wrong'>('pending');
const sentencePinyin = ref<string>('');
const fsrsCard = ref<SentenceCard | null>(null);

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

function rate(r: SentenceRating) {
  emit('rated', props.sentence, r);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="card">
      <p class="text-xs uppercase tracking-wide text-slate-500">Phrase à reformer</p>
      <p class="mt-2 text-lg italic text-slate-200">« {{ sentence.fr }} »</p>
    </div>

    <div
      class="min-h-[88px] rounded-2xl border-2 border-dashed p-3"
      :class="{
        'border-slate-700 bg-slate-900/50': result === 'pending',
        'border-emerald-500 bg-emerald-900/30': result === 'correct',
        'border-red-500 bg-red-900/30': result === 'wrong',
      }"
    >
      <div v-if="!built.length" class="text-center text-sm text-slate-500">
        Choisis les mots dans l'ordre ↓
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="t in built"
          :key="t.uid"
          class="hanzi rounded-lg bg-slate-700 px-3 py-2 text-lg shadow active:scale-95"
          :disabled="result !== 'pending'"
          @click="unpick(t)"
        >
          {{ t.value }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="t in available"
        :key="t.uid"
        class="hanzi rounded-lg bg-slate-800 px-3 py-2 text-lg ring-1 ring-slate-700 active:scale-95"
        @click="pick(t)"
      >
        {{ t.value }}
      </button>
    </div>

    <div v-if="result === 'wrong'" class="card text-center">
      <p class="text-sm text-red-300">Pas tout à fait. La bonne phrase :</p>
      <p class="hanzi mt-2 text-2xl">{{ sentence.zh }}</p>
      <p class="mt-1 text-base text-brand-500">{{ sentencePinyin }}</p>
    </div>

    <div v-if="result === 'correct'" class="card text-center">
      <p class="text-sm text-emerald-300">🎉 Parfait !</p>
      <p class="hanzi mt-2 text-2xl">{{ sentence.zh }}</p>
      <p class="mt-1 text-base text-brand-500">{{ sentencePinyin }}</p>
    </div>

    <div v-if="result === 'pending'" class="flex gap-2">
      <button class="btn-ghost flex-1" @click="emit('skip', sentence)">Passer</button>
      <button
        class="btn-primary flex-1"
        :disabled="built.length !== sentence.tokens.length"
        @click="check"
      >
        Valider
      </button>
    </div>

    <div v-else-if="intervals" class="flex flex-col gap-2">
      <p class="text-center text-xs text-slate-500">
        <span v-if="result === 'correct'">Comment tu l'as sentie ?</span>
        <span v-else>À revoir bientôt</span>
      </p>
      <div class="grid gap-2" :class="allowedRatings.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
        <button
          v-for="r in allowedRatings"
          :key="r"
          class="flex flex-col items-center gap-1 rounded-lg py-3 text-white transition active:scale-95"
          :class="{
            'bg-red-600 hover:bg-red-500': r === 1,
            'bg-orange-500 hover:bg-orange-400': r === 2,
            'bg-emerald-600 hover:bg-emerald-500': r === 3,
            'bg-sky-600 hover:bg-sky-500': r === 4,
          }"
          @click="rate(r)"
        >
          <span class="text-xs font-semibold uppercase tracking-wide">
            <span v-if="r === 1">Encore</span>
            <span v-else-if="r === 2">Difficile</span>
            <span v-else-if="r === 3">Bien</span>
            <span v-else>Facile</span>
          </span>
          <span class="text-xs opacity-80">{{ intervals[r] }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
