<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SentenceItem } from '../lib/sentences';
import { shuffleTokens } from '../lib/sentences';

const props = defineProps<{ sentence: SentenceItem }>();
const emit = defineEmits<{ next: [SentenceItem]; failed: [SentenceItem]; skip: [SentenceItem] }>();

interface Token {
  uid: string;
  value: string;
}

const available = ref<Token[]>([]);
const built = ref<Token[]>([]);
const result = ref<'pending' | 'correct' | 'wrong'>('pending');
const sentencePinyin = ref<string>('');

async function computeSentencePinyin() {
  const { pinyin } = await import('pinyin-pro');
  sentencePinyin.value = pinyin(props.sentence.zh, { toneType: 'symbol', type: 'string' });
}

function reset() {
  const shuffled = shuffleTokens(props.sentence.tokens);
  available.value = shuffled.map((value, i) => ({ uid: `${i}-${value}-${Math.random()}`, value }));
  built.value = [];
  result.value = 'pending';
  sentencePinyin.value = '';
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
      <p class="mt-2 text-xs text-slate-500">Tu la reverras dans quelques phrases.</p>
    </div>

    <div v-if="result === 'correct'" class="card text-center">
      <p class="text-sm text-emerald-300">🎉 Parfait !</p>
      <p class="hanzi mt-2 text-2xl">{{ sentence.zh }}</p>
      <p class="mt-1 text-base text-brand-500">{{ sentencePinyin }}</p>
    </div>

    <div class="flex gap-2">
      <button v-if="result === 'pending'" class="btn-ghost flex-1" @click="emit('skip', sentence)">Passer</button>
      <button
        v-if="result === 'pending'"
        class="btn-primary flex-1"
        :disabled="built.length !== sentence.tokens.length"
        @click="check"
      >
        Valider
      </button>
      <button v-else-if="result === 'wrong'" class="btn-primary flex-1" @click="emit('failed', sentence)">
        Suivant →
      </button>
      <button v-else class="btn-primary flex-1" @click="emit('next', sentence)">Suivant →</button>
    </div>
  </div>
</template>
