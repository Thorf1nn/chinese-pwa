<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Card } from '../lib/db';
import { faceLabel, faceValue, type QuizFace, type QuizQuestion } from '../lib/quiz';

const props = defineProps<{ question: QuizQuestion }>();
const emit = defineEmits<{ done: [correctCount: 0 | 1 | 2] }>();

const firstFace = computed<QuizFace>(() => props.question.hiddenFaces[0]);
const secondFace = computed<QuizFace>(() => props.question.hiddenFaces[1]);

const firstAnswerId = ref<string | null>(null);
const secondAnswerId = ref<string | null>(null);
const step = ref<'first' | 'second' | 'done'>('first');

watch(
  () => props.question.target.id,
  () => {
    firstAnswerId.value = null;
    secondAnswerId.value = null;
    step.value = 'first';
  }
);

const firstCorrect = computed(() => firstAnswerId.value === props.question.correctId);
const secondCorrect = computed(() => secondAnswerId.value === props.question.correctId);

function pickFirst(card: Card) {
  if (firstAnswerId.value) return;
  firstAnswerId.value = card.id;
  setTimeout(() => {
    step.value = 'second';
  }, 600);
}

function pickSecond(card: Card) {
  if (secondAnswerId.value) return;
  secondAnswerId.value = card.id;
  const total = (firstCorrect.value ? 1 : 0) + (card.id === props.question.correctId ? 1 : 0);
  setTimeout(() => {
    step.value = 'done';
    emit('done', total as 0 | 1 | 2);
  }, 900);
}

function optionClass(face: QuizFace, card: Card, answerId: string | null): string {
  if (!answerId) return 'btn-ghost';
  const isCorrect = card.id === props.question.correctId;
  const isChosen = card.id === answerId;
  if (isCorrect) return 'bg-emerald-600 text-white';
  if (isChosen) return 'bg-red-600 text-white';
  return 'btn-ghost opacity-50';
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-6">
    <div class="card text-center">
      <p class="text-xs uppercase tracking-wide text-slate-500">
        {{ faceLabel(question.visibleFace) }}
      </p>
      <p
        class="mt-2"
        :class="{
          'hanzi text-6xl font-semibold': question.visibleFace === 'hanzi',
          'text-3xl text-brand-500': question.visibleFace === 'pinyin',
          'text-2xl text-slate-100': question.visibleFace === 'french',
        }"
      >
        {{ faceValue(question.target, question.visibleFace) }}
      </p>
    </div>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-300">
        Quel est le {{ faceLabel(firstFace) }} ?
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in question.optionsByFace[firstFace]"
          :key="opt.id + ':' + firstFace"
          class="rounded-lg px-3 py-3 text-sm transition active:scale-95"
          :class="[
            optionClass(firstFace, opt, firstAnswerId),
            firstFace === 'hanzi' ? 'hanzi text-xl' : '',
          ]"
          :disabled="!!firstAnswerId"
          @click="pickFirst(opt)"
        >
          {{ faceValue(opt, firstFace) }}
        </button>
      </div>
    </section>

    <section v-if="step !== 'first'">
      <h3 class="mb-2 text-sm font-semibold text-slate-300">
        Quel est le {{ faceLabel(secondFace) }} ?
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in question.optionsByFace[secondFace]"
          :key="opt.id + ':' + secondFace"
          class="rounded-lg px-3 py-3 text-sm transition active:scale-95"
          :class="[
            optionClass(secondFace, opt, secondAnswerId),
            secondFace === 'hanzi' ? 'hanzi text-xl' : '',
          ]"
          :disabled="!!secondAnswerId"
          @click="pickSecond(opt)"
        >
          {{ faceValue(opt, secondFace) }}
        </button>
      </div>
    </section>

    <div v-if="step === 'done'" class="card text-center">
      <p class="text-xs uppercase tracking-wide text-slate-500">Réponse</p>
      <p class="hanzi mt-1 text-3xl">{{ question.target.simplified }}</p>
      <p class="mt-1 text-lg text-brand-500">{{ question.target.pinyin }}</p>
      <ul class="mt-2 space-y-0.5 text-sm text-slate-200">
        <li v-for="(d, i) in question.target.definitions.slice(0, 3)" :key="i">· {{ d }}</li>
      </ul>
    </div>
  </div>
</template>
