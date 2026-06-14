<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Lightbulb } from 'lucide-vue-next';
import type { GrammarItem } from '../lib/grammar';
import { segmentText } from '../lib/reader';
import { shuffleTokens } from '../lib/sentences';
import {
  getOrCreateGrammarProgress,
  previewGrammarIntervals,
  type GrammarRating,
} from '../lib/grammar-fsrs';
import type { GrammarProgress } from '../lib/db';
import { Badge, Button, Separator } from './ui';

const props = defineProps<{ item: GrammarItem }>();
const emit = defineEmits<{ rated: [GrammarItem, GrammarRating] }>();

interface Token {
  uid: string;
  value: string;
}

const HAN = /[㐀-鿿豈-﫿]/;
const isChinese = (token: string) => HAN.test(token);

const tokens = ref<string[]>([]);
const available = ref<Token[]>([]);
const built = ref<Token[]>([]);
const result = ref<'pending' | 'correct' | 'wrong'>('pending');
const progress = ref<GrammarProgress | null>(null);
const showRule = ref(false);
const ready = ref(false);

async function setup() {
  ready.value = false;
  result.value = 'pending';
  built.value = [];
  showRule.value = false;
  progress.value = null;

  const segments = await segmentText(props.item.sentence);
  const chineseTokens = segments.filter((s) => s.isChinese).map((s) => s.text);
  tokens.value = chineseTokens.length > 1 ? chineseTokens : [...props.item.sentence];

  const shuffled = shuffleTokens(tokens.value);
  available.value = shuffled.map((value, i) => ({ uid: `${i}-${value}-${Math.random()}`, value }));

  progress.value = await getOrCreateGrammarProgress(props.item.id, props.item.level);
  ready.value = true;
}

watch(() => props.item.id, setup, { immediate: true });

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
  if (built.value.length !== tokens.value.length) return;
  const joined = built.value.map((t) => t.value).join('');
  const target = tokens.value.join('');
  result.value = joined === target ? 'correct' : 'wrong';
  showRule.value = true;
}

const intervals = computed(() =>
  progress.value ? previewGrammarIntervals(progress.value) : null
);

const allowedRatings = computed<GrammarRating[]>(() =>
  result.value === 'correct' ? [2, 3, 4] : [1, 2]
);

const ratingLabels: Record<GrammarRating, string> = {
  1: 'Encore',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
};

const ratingTones: Record<GrammarRating, string> = {
  1: 'hover:border-destructive/60 hover:bg-destructive/10',
  2: 'hover:border-amber-500/60 hover:bg-amber-500/10',
  3: 'hover:border-emerald-500/60 hover:bg-emerald-500/10',
  4: 'hover:border-sky-500/60 hover:bg-sky-500/10',
};

function rate(r: GrammarRating) {
  emit('rated', props.item, r);
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div class="flex items-center gap-2">
        <Lightbulb :size="15" class="text-primary" />
        <p class="text-sm font-semibold">{{ item.title }}</p>
        <Badge variant="primary" class="ml-auto">HSK {{ item.level }}</Badge>
      </div>
      <p v-if="item.structure" class="hanzi mt-2 text-sm text-muted-foreground">
        {{ item.structure }}
      </p>
    </div>

    <div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Reforme la phrase</p>
      <p class="mt-2 font-serif text-lg italic">« {{ item.translation }} »</p>
    </div>

    <div
      class="min-h-[80px] rounded-md border-2 border-dashed p-3 transition-colors"
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

    <template v-if="result !== 'pending'">
      <Separator />
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span v-if="result === 'correct'">Bonne phrase</span>
          <span v-else>La bonne phrase</span>
        </p>
        <p class="hanzi mt-2 text-2xl">{{ item.sentence }}</p>
        <p v-if="item.pinyin" class="mt-1 font-editorial text-base text-primary">{{ item.pinyin }}</p>
      </div>

      <div v-if="item.explanation" class="rounded-md border-l-2 border-primary bg-muted/30 p-4">
        <p class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Règle</p>
        <p class="mt-1.5 text-sm">{{ item.explanation }}</p>
      </div>
    </template>

    <div v-if="result === 'pending'" class="flex gap-2">
      <Button
        variant="primary"
        full
        :disabled="!ready || built.length !== tokens.length"
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
