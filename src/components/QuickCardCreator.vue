<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, Plus } from 'lucide-vue-next';
import { db, type DictEntry } from '../lib/db';
import { useDeckStore } from '../stores/deck';
import { Badge, Button, Input, Textarea } from './ui';

const emit = defineEmits<{ close: []; created: [string] }>();

const deck = useDeckStore();

const HAN = /[㐀-鿿豈-﫿]/;

const hanzi = ref('');
const pinyin = ref('');
const definitionsText = ref('');
const context = ref('');
const contextFr = ref('');

const lookupState = ref<'idle' | 'searching' | 'found' | 'manual'>('idle');
const matches = ref<DictEntry[]>([]);
const saving = ref(false);
const justSaved = ref(false);

let lookupTimer: number | null = null;

const trimmedHanzi = computed(() => hanzi.value.trim());
const alreadyInDeck = computed(() =>
  trimmedHanzi.value ? deck.cards.some((c) => c.simplified === trimmedHanzi.value) : false
);

const canSave = computed(() => {
  if (!trimmedHanzi.value || !HAN.test(trimmedHanzi.value)) return false;
  const defs = parseDefinitions();
  return defs.length > 0 || pinyin.value.trim().length > 0;
});

function parseDefinitions(): string[] {
  return definitionsText.value
    .split(/[,;\n]/)
    .map((d) => d.trim())
    .filter(Boolean);
}

watch(hanzi, () => {
  justSaved.value = false;
  if (lookupTimer) window.clearTimeout(lookupTimer);
  const q = trimmedHanzi.value;
  if (!q || !HAN.test(q)) {
    lookupState.value = 'idle';
    matches.value = [];
    return;
  }
  lookupState.value = 'searching';
  lookupTimer = window.setTimeout(runLookup, 220);
});

async function runLookup() {
  const q = trimmedHanzi.value;
  if (!q) return;
  const exact = await db.dict.where('simplified').equals(q).toArray();
  if (exact.length > 0) {
    matches.value = exact;
    applyEntry(exact[0]);
    lookupState.value = 'found';
  } else {
    matches.value = [];
    await fillPinyinFallback(q);
    lookupState.value = 'manual';
  }
}

function applyEntry(entry: DictEntry) {
  pinyin.value = entry.pinyin;
  definitionsText.value = entry.definitions.join(', ');
}

async function fillPinyinFallback(q: string) {
  try {
    const { pinyin: toPinyin } = await import('pinyin-pro');
    pinyin.value = toPinyin(q, { toneType: 'symbol', type: 'string' });
  } catch {
    pinyin.value = '';
  }
  if (!definitionsText.value.trim()) definitionsText.value = '';
}

async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  try {
    const entry: DictEntry = {
      simplified: trimmedHanzi.value,
      traditional: trimmedHanzi.value,
      pinyin: pinyin.value.trim(),
      pinyinPlain: '',
      definitions: parseDefinitions(),
    };
    const card = await deck.addFromDictEntry(entry, ['perso']);
    if (card && context.value.trim()) {
      await deck.addSentence(card.id, {
        zh: context.value.trim(),
        fr: contextFr.value.trim() || undefined,
        source: 'perso',
      });
    }
    justSaved.value = true;
    if (card) emit('created', card.id);
    resetForNext();
  } finally {
    saving.value = false;
  }
}

function resetForNext() {
  hanzi.value = '';
  pinyin.value = '';
  definitionsText.value = '';
  context.value = '';
  contextFr.value = '';
  lookupState.value = 'idle';
  matches.value = [];
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-baseline justify-between">
      <h2 class="font-serif text-xl italic">Nouveau mot</h2>
      <button class="text-sm text-muted-foreground hover:text-foreground" @click="emit('close')">
        fermer
      </button>
    </div>

    <div class="space-y-2">
      <label class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Caractère(s)</label>
      <Input
        v-model="hanzi"
        class="hanzi text-2xl"
        placeholder="你好"
        autofocus
        lang="zh"
      />
      <p v-if="trimmedHanzi && !HAN.test(trimmedHanzi)" class="text-xs text-amber-600">
        Tape des caractères chinois (clavier chinois).
      </p>
      <p v-else-if="alreadyInDeck && !justSaved" class="text-xs text-amber-600">
        Ce mot est déjà dans ton deck — l'ajouter le mettra à jour.
      </p>
    </div>

    <div v-if="lookupState === 'searching'" class="text-xs text-muted-foreground">
      Recherche dans le dictionnaire…
    </div>

    <div
      v-if="lookupState === 'found' && matches.length > 1"
      class="flex flex-wrap gap-2"
    >
      <button
        v-for="(m, i) in matches"
        :key="i"
        class="rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs transition hover:border-primary"
        @click="applyEntry(m)"
      >
        <span class="font-editorial text-primary">{{ m.pinyin }}</span>
        <span class="text-muted-foreground"> · {{ m.definitions[0] }}</span>
      </button>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pinyin</label>
        <Badge v-if="lookupState === 'found'" variant="outline">CFDICT</Badge>
        <Badge v-else-if="lookupState === 'manual'" variant="outline">auto</Badge>
      </div>
      <Input v-model="pinyin" class="font-editorial" placeholder="nǐ hǎo" />
    </div>

    <div class="space-y-2">
      <label class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Traduction(s)
      </label>
      <Textarea
        v-model="definitionsText"
        :rows="2"
        placeholder="bonjour, salut (séparées par des virgules)"
      />
    </div>

    <details class="group">
      <summary class="cursor-pointer text-xs uppercase tracking-[0.16em] text-muted-foreground">
        + Ajouter du contexte
      </summary>
      <div class="mt-3 space-y-3">
        <Textarea
          v-model="context"
          :rows="2"
          class="hanzi"
          placeholder="Phrase d'exemple en chinois"
        />
        <Input v-model="contextFr" placeholder="Traduction de l'exemple (optionnel)" />
      </div>
    </details>

    <Button variant="primary" full :disabled="!canSave || saving" @click="save">
      <Plus v-if="!saving && !justSaved" :size="16" class="mr-1.5" />
      <Check v-if="justSaved" :size="16" class="mr-1.5" />
      <span v-if="saving">Ajout…</span>
      <span v-else-if="justSaved">Ajouté · mot suivant</span>
      <span v-else>Ajouter au deck</span>
    </Button>
  </div>
</template>
