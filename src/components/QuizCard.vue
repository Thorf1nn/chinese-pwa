<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Card } from '../lib/db';
import { faceLabel, faceValue, type QuizFace, type QuizQuestion } from '../lib/quiz';
import { cn } from '../lib/utils';

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

function pickFirst(card: Card) {
  if (firstAnswerId.value) return;
  firstAnswerId.value = card.id;
  setTimeout(() => {
    step.value = 'second';
  }, 450);
}

function pickSecond(card: Card) {
  if (secondAnswerId.value) return;
  secondAnswerId.value = card.id;
  const total = (firstCorrect.value ? 1 : 0) + (card.id === props.question.correctId ? 1 : 0);
  setTimeout(() => {
    step.value = 'done';
    emit('done', total as 0 | 1 | 2);
  }, 400);
}

function optionClass(card: Card, answerId: string | null, face: QuizFace): string {
  const base =
    'flex w-full items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left transition';
  const correct = card.id === props.question.correctId;
  const chosen = card.id === answerId;
  const hanziClass = face === 'hanzi' ? 'hanzi text-lg' : 'text-sm';
  if (!answerId) {
    return cn(base, hanziClass, 'hover:border-primary/60 hover:bg-muted');
  }
  if (correct) return cn(base, hanziClass, 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400');
  if (chosen) return cn(base, hanziClass, 'border-destructive/60 bg-destructive/10 text-destructive');
  return cn(base, hanziClass, 'opacity-40');
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="text-center">
      <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {{ faceLabel(question.visibleFace) }}
      </p>
      <p
        class="mt-4"
        :class="{
          'hanzi text-6xl font-semibold': question.visibleFace === 'hanzi',
          'font-editorial text-3xl text-primary': question.visibleFace === 'pinyin',
          'font-serif text-2xl italic text-foreground': question.visibleFace === 'french',
        }"
      >
        {{ faceValue(question.target, question.visibleFace) }}
      </p>
    </div>

    <section class="space-y-3">
      <p class="text-xs uppercase tracking-wide text-muted-foreground">
        Quel est le {{ faceLabel(firstFace) }} ?
      </p>
      <div class="flex flex-col gap-2">
        <button
          v-for="opt in question.optionsByFace[firstFace]"
          :key="opt.id + ':' + firstFace"
          :class="optionClass(opt, firstAnswerId, firstFace)"
          :disabled="!!firstAnswerId"
          @click="pickFirst(opt)"
        >
          <span>{{ faceValue(opt, firstFace) }}</span>
        </button>
      </div>
    </section>

    <section v-if="step !== 'first'" class="space-y-3">
      <p class="text-xs uppercase tracking-wide text-muted-foreground">
        Quel est le {{ faceLabel(secondFace) }} ?
      </p>
      <div class="flex flex-col gap-2">
        <button
          v-for="opt in question.optionsByFace[secondFace]"
          :key="opt.id + ':' + secondFace"
          :class="optionClass(opt, secondAnswerId, secondFace)"
          :disabled="!!secondAnswerId"
          @click="pickSecond(opt)"
        >
          <span>{{ faceValue(opt, secondFace) }}</span>
        </button>
      </div>
    </section>

    <section v-if="step === 'done'" class="border-l-2 border-primary/50 pl-4 text-left">
      <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Réponse</p>
      <p class="hanzi mt-1 text-3xl">{{ question.target.simplified }}</p>
      <p class="mt-1 font-editorial text-base text-primary">{{ question.target.pinyin }}</p>
      <ul class="mt-2 space-y-0.5 text-sm text-foreground">
        <li v-for="(d, i) in question.target.definitions.slice(0, 3)" :key="i">— {{ d }}</li>
      </ul>
    </section>
  </div>
</template>
