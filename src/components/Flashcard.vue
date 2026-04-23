<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Card } from '../lib/db';
import { Button, Separator } from './ui';

const props = defineProps<{ card: Card }>();
const revealed = ref(false);

watch(
  () => props.card.id,
  () => {
    revealed.value = false;
  }
);

function reveal() {
  revealed.value = true;
}

defineExpose({ revealed });
</script>

<template>
  <div class="flex flex-col items-center gap-6 text-center">
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
            <p v-if="s.source" class="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
              — {{ s.source }}
            </p>
          </div>
        </div>
      </template>
    </template>

    <Button v-else variant="outline" full @click="reveal">Afficher la réponse</Button>
  </div>
</template>
