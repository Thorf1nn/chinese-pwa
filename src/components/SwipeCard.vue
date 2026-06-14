<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RotateCcw, Check } from 'lucide-vue-next';
import type { Card } from '../lib/db';
import { previewIntervals, type ReviewRating } from '../lib/fsrs';
import { Separator } from './ui';

const props = defineProps<{ card: Card }>();
const emit = defineEmits<{ rate: [ReviewRating] }>();

const revealed = ref(false);
const dragX = ref(0);
const dragY = ref(0);
const dragging = ref(false);
const leaving = ref<'left' | 'right' | null>(null);

const SWIPE_THRESHOLD = 110;
const RATING_AGAIN: ReviewRating = 1;
const RATING_GOOD: ReviewRating = 3;

let pointerId: number | null = null;
let startX = 0;
let startY = 0;

const intervals = computed(() => previewIntervals(props.card));

const rotation = computed(() => dragX.value * 0.06);
const overlayOpacity = computed(() => Math.min(Math.abs(dragX.value) / SWIPE_THRESHOLD, 1));
const intent = computed<'left' | 'right' | null>(() => {
  if (Math.abs(dragX.value) < 24) return null;
  return dragX.value > 0 ? 'right' : 'left';
});

const cardStyle = computed(() => {
  if (leaving.value) {
    const dir = leaving.value === 'right' ? 1 : -1;
    return {
      transform: `translate(${dir * 460}px, ${dragY.value}px) rotate(${dir * 18}deg)`,
      opacity: '0',
      transition: 'transform 0.32s ease-out, opacity 0.32s ease-out',
    };
  }
  return {
    transform: `translate(${dragX.value}px, ${dragY.value}px) rotate(${rotation.value}deg)`,
    transition: dragging.value ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  };
});

watch(
  () => props.card.id,
  () => {
    revealed.value = false;
    dragX.value = 0;
    dragY.value = 0;
    dragging.value = false;
    leaving.value = null;
    pointerId = null;
  }
);

function reveal() {
  if (dragging.value || Math.abs(dragX.value) > 6) return;
  revealed.value = true;
}

function onPointerDown(e: PointerEvent) {
  if (leaving.value) return;
  pointerId = e.pointerId;
  startX = e.clientX;
  startY = e.clientY;
  dragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return;
  dragX.value = e.clientX - startX;
  dragY.value = (e.clientY - startY) * 0.35;
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return;
  dragging.value = false;
  pointerId = null;
  if (dragX.value >= SWIPE_THRESHOLD) {
    fly('right');
  } else if (dragX.value <= -SWIPE_THRESHOLD) {
    fly('left');
  } else {
    dragX.value = 0;
    dragY.value = 0;
  }
}

function fly(dir: 'left' | 'right') {
  leaving.value = dir;
  window.setTimeout(() => {
    emit('rate', dir === 'right' ? RATING_GOOD : RATING_AGAIN);
  }, 300);
}

function triggerButton(dir: 'left' | 'right') {
  if (leaving.value) return;
  dragX.value = dir === 'right' ? SWIPE_THRESHOLD : -SWIPE_THRESHOLD;
  fly(dir);
}

defineExpose({ revealed });
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="relative w-full select-none" style="touch-action: pan-y;">
      <div
        class="relative flex min-h-[340px] cursor-grab flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm active:cursor-grabbing"
        :style="cardStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @click="reveal"
      >
        <div
          class="pointer-events-none absolute left-4 top-4 rounded-md border-2 border-destructive px-3 py-1 text-sm font-bold uppercase tracking-widest text-destructive transition-opacity"
          :style="{ opacity: intent === 'left' ? overlayOpacity : 0 }"
        >
          À revoir
        </div>
        <div
          class="pointer-events-none absolute right-4 top-4 rounded-md border-2 border-emerald-500 px-3 py-1 text-sm font-bold uppercase tracking-widest text-emerald-500 transition-opacity"
          :style="{ opacity: intent === 'right' ? overlayOpacity : 0 }"
        >
          Je connais
        </div>

        <p class="hanzi text-7xl font-semibold tracking-wide">{{ card.simplified }}</p>

        <template v-if="revealed">
          <p class="font-editorial text-2xl text-primary">{{ card.pinyin }}</p>
          <ul class="space-y-0.5 text-base">
            <li v-for="(d, i) in card.definitions" :key="i">— {{ d }}</li>
          </ul>

          <template v-if="card.sentences.length">
            <Separator />
            <div class="w-full space-y-3 text-left">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Exemples</p>
              <div
                v-for="s in card.sentences"
                :key="s.id"
                class="border-l-2 border-border pl-3"
              >
                <p class="hanzi text-lg">{{ s.zh }}</p>
                <p v-if="s.fr" class="mt-0.5 text-sm text-muted-foreground">{{ s.fr }}</p>
              </div>
            </div>
          </template>
        </template>

        <p v-else class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Tape pour révéler
        </p>
      </div>
    </div>

    <div class="flex w-full items-center justify-center gap-4">
      <button
        class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-destructive/40 bg-card text-destructive transition active:scale-90 hover:border-destructive hover:bg-destructive/10"
        aria-label="À revoir"
        @click="triggerButton('left')"
      >
        <RotateCcw :size="26" :stroke-width="2" />
      </button>

      <div class="flex min-w-[88px] flex-col items-center text-center">
        <span class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Intervalle</span>
        <span class="font-editorial text-sm tabular-nums">
          {{ intervals[RATING_AGAIN] }} · {{ intervals[RATING_GOOD] }}
        </span>
      </div>

      <button
        class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-card text-emerald-600 transition active:scale-90 hover:border-emerald-500 hover:bg-emerald-500/10 dark:text-emerald-400"
        aria-label="Je connais"
        @click="triggerButton('right')"
      >
        <Check :size="28" :stroke-width="2.4" />
      </button>
    </div>

    <p class="text-center text-[11px] text-muted-foreground">
      Swipe ← à revoir · → je connais
    </p>
  </div>
</template>
