<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { db, type DictEntry } from '../lib/db';
import { useDeckStore } from '../stores/deck';
import { Badge, Button, PageHeader, Progress, Sheet } from '../components/ui';

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
const sheetOpen = ref(false);

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
    'recognizing text': "Analyse de l'image...",
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
  sheetOpen.value = false;
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

function onTokenTap(token: ResolvedToken) {
  selectedToken.value = token;
  sheetOpen.value = true;
}

onMounted(async () => {
  if (!deck.loaded) await deck.loadAll();
  startCamera();
});

onBeforeUnmount(stopCamera);
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col gap-6 px-6 pt-8">
    <PageHeader
      eyebrow="OCR"
      title="Scanner"
      subtitle="Pointe ton appareil sur du texte chinois."
    />

    <div
      v-if="cameraError"
      class="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <p class="font-medium">Caméra inaccessible</p>
      <p class="mt-1 text-xs">{{ cameraError }}</p>
      <p class="mt-2 text-xs">
        iOS Safari nécessite HTTPS + autorisation caméra.
      </p>
      <Button variant="outline" size="sm" class="mt-3" @click="startCamera">Réessayer</Button>
    </div>

    <div v-if="!capturedImage" class="relative overflow-hidden rounded-md border border-border bg-black">
      <video
        ref="video"
        class="block aspect-[3/4] w-full object-cover"
        playsinline
        muted
      />
      <p
        v-if="!cameraReady && !cameraError"
        class="absolute inset-0 flex items-center justify-center text-sm text-white"
      >
        Accès caméra...
      </p>
    </div>

    <img v-if="capturedImage" :src="capturedImage" class="w-full rounded-md" alt="Capture" />

    <canvas ref="canvas" class="hidden" />

    <div v-if="ocrRunning" class="space-y-2">
      <p class="text-sm">{{ ocrStatus }}</p>
      <Progress :value="ocrProgress" />
    </div>

    <Button v-if="!capturedImage && !cameraError" variant="primary" full :disabled="!cameraReady" @click="capture">
      Scanner
    </Button>

    <Button v-if="capturedImage && !ocrRunning" variant="outline" full @click="reset">
      ↻ Nouveau scan
    </Button>

    <section v-if="tokens.length && !ocrRunning" class="space-y-3">
      <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Texte détecté</p>
      <div class="hanzi flex flex-wrap gap-1 text-2xl leading-loose">
        <button
          v-for="(t, i) in tokens"
          :key="i"
          class="rounded px-1 transition"
          :class="{
            'underline decoration-primary/60 decoration-1 underline-offset-[3px] hover:bg-muted':
              t.entry,
            'cursor-default text-muted-foreground': t.isHan && !t.entry,
            'cursor-default text-muted-foreground/60': !t.isHan,
            'bg-primary/20': selectedToken === t,
          }"
          :disabled="!t.entry"
          @click="onTokenTap(t)"
        >
          {{ t.text }}
        </button>
      </div>
    </section>

    <Sheet v-model:open="sheetOpen">
      <template v-if="selectedToken && selectedToken.entry">
        <div class="space-y-4">
          <div class="flex items-baseline gap-3">
            <span class="hanzi text-4xl font-semibold">{{ selectedToken.entry.simplified }}</span>
            <span class="font-editorial text-lg text-primary">{{ selectedToken.entry.pinyin }}</span>
            <Badge variant="outline" class="ml-auto">CFDICT</Badge>
          </div>
          <ul class="space-y-0.5 text-sm">
            <li v-for="(d, i) in selectedToken.entry.definitions.slice(0, 5)" :key="i">— {{ d }}</li>
          </ul>
          <Button
            :variant="inDeck(selectedToken) ? 'outline' : 'primary'"
            full
            :disabled="inDeck(selectedToken) || busyAddId !== null"
            @click="addToDeck(selectedToken)"
          >
            <span v-if="inDeck(selectedToken)">✓ Déjà dans ton deck</span>
            <span v-else-if="busyAddId">Ajout...</span>
            <span v-else>+ Ajouter à mon deck</span>
          </Button>
        </div>
      </template>
    </Sheet>

    <p class="text-center text-[11px] italic text-muted-foreground/70">
      Tesseract.js · premier scan = 15 Mo téléchargés, puis offline.
    </p>
  </section>
</template>
