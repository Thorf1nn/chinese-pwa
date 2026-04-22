<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { db, type DictEntry } from '../lib/db';
import { useDeckStore } from '../stores/deck';

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const deck = useDeckStore();

const stream = ref<MediaStream | null>(null);
const cameraError = ref<string | null>(null);
const cameraReady = ref(false);

const capturedImage = ref<string | null>(null);
const ocrProgress = ref(0);
const ocrStatus = ref('');
const ocrRunning = ref(false);
const ocrResult = ref<string>('');

interface ResolvedToken {
  text: string;
  entry: DictEntry | null;
  isHan: boolean;
}

const tokens = ref<ResolvedToken[]>([]);
const selectedToken = ref<ResolvedToken | null>(null);
const busyAddId = ref<string | null>(null);

async function startCamera() {
  cameraError.value = null;
  cameraReady.value = false;
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    if (video.value) {
      video.value.srcObject = stream.value;
      await video.value.play();
      cameraReady.value = true;
    }
  } catch (err) {
    cameraError.value = err instanceof Error ? err.message : String(err);
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach((t) => t.stop());
  stream.value = null;
  cameraReady.value = false;
}

async function capture() {
  if (!video.value || !canvas.value) return;
  const v = video.value;
  const c = canvas.value;
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(v, 0, 0, c.width, c.height);
  capturedImage.value = c.toDataURL('image/png');
  await runOcr(capturedImage.value);
}

async function runOcr(imageData: string) {
  ocrRunning.value = true;
  ocrProgress.value = 0;
  ocrStatus.value = 'Chargement OCR...';
  ocrResult.value = '';
  tokens.value = [];
  selectedToken.value = null;

  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('chi_sim', 1, {
      logger: (m) => {
        if (typeof m.progress === 'number') ocrProgress.value = Math.round(m.progress * 100);
        if (typeof m.status === 'string') ocrStatus.value = translateStatus(m.status);
      },
    });
    const { data } = await worker.recognize(imageData);
    await worker.terminate();
    ocrResult.value = (data.text ?? '').trim();
    await resolveTokens(ocrResult.value);
  } catch (err) {
    ocrStatus.value = `Erreur OCR: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    ocrRunning.value = false;
  }
}

function translateStatus(s: string): string {
  const map: Record<string, string> = {
    'loading tesseract core': 'Chargement du moteur...',
    'initializing tesseract': 'Initialisation...',
    'loading language traineddata': 'Téléchargement modèle chinois (~15 Mo)...',
    'initializing api': 'Préparation...',
    'recognizing text': 'Analyse de l\'image...',
  };
  return map[s] ?? s;
}

const HAN = /[\u3400-\u9FFF\uF900-\uFAFF]/;

async function resolveTokens(text: string) {
  const cleaned = text.replace(/\s+/g, '');
  const out: ResolvedToken[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (!HAN.test(ch)) {
      out.push({ text: ch, entry: null, isHan: false });
      i++;
      continue;
    }
    let matched: DictEntry | null = null;
    let matchLen = 1;
    for (let len = Math.min(6, cleaned.length - i); len >= 1; len--) {
      const candidate = cleaned.substring(i, i + len);
      if (!HAN.test(candidate)) continue;
      const entry = await db.dict.where('simplified').equals(candidate).first();
      if (entry) {
        matched = entry;
        matchLen = len;
        break;
      }
    }
    if (matched) {
      out.push({ text: cleaned.substring(i, i + matchLen), entry: matched, isHan: true });
      i += matchLen;
    } else {
      out.push({ text: ch, entry: null, isHan: true });
      i++;
    }
  }
  tokens.value = out;
}

function reset() {
  capturedImage.value = null;
  ocrResult.value = '';
  tokens.value = [];
  selectedToken.value = null;
  if (!cameraReady.value) startCamera();
}

async function addToDeck(token: ResolvedToken) {
  if (!token.entry) return;
  busyAddId.value = token.entry.id ? String(token.entry.id) : token.text;
  try {
    await deck.addFromDictEntry(token.entry, ['scan']);
  } finally {
    busyAddId.value = null;
  }
}

function inDeck(token: ResolvedToken): boolean {
  if (!token.entry) return false;
  return deck.cards.some((c) => c.simplified === token.entry!.simplified);
}

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
  startCamera();
});

onBeforeUnmount(() => {
  stopCamera();
});
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
    <header>
      <h1 class="text-2xl font-bold">Scanner</h1>
      <p class="mt-1 text-sm text-slate-400">
        Pointe ton appareil sur du texte chinois, puis touche les mots pour les traduire.
      </p>
    </header>

    <div
      v-if="cameraError"
      class="rounded-lg bg-red-900/40 p-4 text-sm text-red-200"
    >
      <p class="font-semibold">Caméra inaccessible</p>
      <p class="mt-1 text-xs">{{ cameraError }}</p>
      <p class="mt-2 text-xs text-red-300">
        iOS Safari nécessite HTTPS + autorisation caméra. Si tu as refusé, va dans Réglages iOS →
        Safari → Autoriser caméra.
      </p>
      <button class="btn-ghost mt-3" @click="startCamera">Réessayer</button>
    </div>

    <div v-if="!capturedImage" class="relative overflow-hidden rounded-xl bg-black">
      <video
        ref="video"
        class="block aspect-[3/4] w-full object-cover"
        playsinline
        muted
      />
      <div
        v-if="!cameraReady && !cameraError"
        class="absolute inset-0 flex items-center justify-center text-sm text-slate-300"
      >
        Accès caméra...
      </div>
    </div>

    <div v-if="capturedImage" class="space-y-3">
      <img :src="capturedImage" class="w-full rounded-xl" alt="Capture" />
    </div>

    <canvas ref="canvas" class="hidden" />

    <div v-if="ocrRunning" class="card">
      <p class="text-sm">{{ ocrStatus }}</p>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="h-full bg-brand-500 transition-[width]" :style="{ width: ocrProgress + '%' }" />
      </div>
    </div>

    <div v-if="!capturedImage && !cameraError" class="flex gap-2">
      <button
        class="btn-primary flex-1"
        :disabled="!cameraReady"
        @click="capture"
      >
        📸 Scanner
      </button>
    </div>

    <div v-if="capturedImage && !ocrRunning" class="flex gap-2">
      <button class="btn-ghost flex-1" @click="reset">↻ Nouveau scan</button>
    </div>

    <article v-if="tokens.length && !ocrRunning" class="card">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Texte détecté</h2>
      <p class="mt-2 text-xs text-slate-500">
        Tape sur un mot pour voir sa traduction. Les mots reconnus par le dictionnaire sont
        soulignés.
      </p>
      <div class="hanzi mt-3 flex flex-wrap gap-1 text-2xl leading-loose">
        <button
          v-for="(t, i) in tokens"
          :key="i"
          class="rounded px-1 transition"
          :class="{
            'bg-brand-500/20 underline decoration-brand-500 decoration-2 underline-offset-4 hover:bg-brand-500/30':
              t.entry,
            'cursor-default text-slate-500': t.isHan && !t.entry,
            'cursor-default text-slate-600': !t.isHan,
            'bg-brand-500/40': selectedToken === t,
          }"
          :disabled="!t.entry"
          @click="selectedToken = t"
        >
          {{ t.text }}
        </button>
      </div>
    </article>

    <article v-if="selectedToken && selectedToken.entry" class="card">
      <div class="flex items-baseline gap-2">
        <span class="hanzi text-3xl font-semibold">{{ selectedToken.entry.simplified }}</span>
        <span class="text-sm text-brand-500">{{ selectedToken.entry.pinyin }}</span>
      </div>
      <ul class="mt-2 space-y-0.5 text-sm text-slate-200">
        <li v-for="(d, i) in selectedToken.entry.definitions.slice(0, 5)" :key="i">· {{ d }}</li>
      </ul>
      <button
        class="btn mt-3 w-full"
        :class="inDeck(selectedToken) ? 'bg-emerald-700 text-white' : 'btn-primary'"
        :disabled="inDeck(selectedToken) || busyAddId !== null"
        @click="addToDeck(selectedToken)"
      >
        <span v-if="inDeck(selectedToken)">✓ Déjà dans ton deck</span>
        <span v-else-if="busyAddId">Ajout...</span>
        <span v-else>+ Ajouter à mon deck</span>
      </button>
    </article>

    <p class="mt-2 text-center text-xs text-slate-500">
      OCR via <a class="underline" href="https://github.com/naptha/tesseract.js" target="_blank" rel="noopener">Tesseract.js</a>
      — le premier scan télécharge ~15 Mo (modèle chinois), ensuite tout est offline.
    </p>

    <RouterLink to="/dashboard" class="btn-ghost">← Dashboard</RouterLink>
  </section>
</template>
