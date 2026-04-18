import { existsSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FILES = {
  zh: path.join(__dirname, 'cmn_sentences.tsv'),
  fr: path.join(__dirname, 'fra_sentences.tsv'),
  links: path.join(__dirname, 'cmn-fra_links.tsv'),
};

function ensureExists(file: string, hint: string) {
  if (existsSync(file)) return;
  console.error(`Manque ${path.basename(file)}.`);
  console.error(`Télécharge et décompresse :\n  ${hint}`);
  process.exit(1);
}

interface ZhSentence {
  id: number;
  text: string;
}

interface FrSentence {
  id: number;
  text: string;
}

function parseTsv(file: string, lang: string): Map<number, string> {
  const map = new Map<number, string>();
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const id = Number(parts[0]);
    const lng = parts[1];
    const sentence = parts[2];
    if (lng === lang && Number.isFinite(id)) {
      map.set(id, sentence);
    }
  }
  return map;
}

function parseLinks(file: string, zhIds: Set<number>, frIds: Set<number>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const [aRaw, bRaw] = line.split(/\t|,/);
    const a = Number(aRaw);
    const b = Number(bRaw);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (zhIds.has(a) && frIds.has(b)) out.push([a, b]);
  }
  return out;
}

const HAN = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const PUNCT = /[，。！？、；：「」『』""'']/g;

function stripPunctuation(text: string): string {
  return text.replace(PUNCT, '').replace(/[.!?,;:]/g, '').trim();
}

function isPunctuation(token: string): boolean {
  return /^[\s，。！？、；：「」『』""''.!?,;:]+$/.test(token);
}

interface OutputSentence {
  zh: string;
  fr: string;
  tokens: string[];
}

async function main() {
  console.log('Vérification des fichiers source Tatoeba...');
  ensureExists(FILES.zh, 'curl -o cmn_sentences.tsv.bz2 https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2 && bunzip2 cmn_sentences.tsv.bz2');
  ensureExists(FILES.fr, 'curl -o fra_sentences.tsv.bz2 https://downloads.tatoeba.org/exports/per_language/fra/fra_sentences.tsv.bz2 && bunzip2 fra_sentences.tsv.bz2');
  ensureExists(FILES.links, 'curl -o cmn-fra_links.tsv.bz2 https://downloads.tatoeba.org/exports/per_language/cmn/cmn-fra_links.tsv.bz2 && bunzip2 cmn-fra_links.tsv.bz2');

  console.log('Parsing des phrases chinoises...');
  const zhMap = parseTsv(FILES.zh, 'cmn');
  console.log(`  ${zhMap.size.toLocaleString('fr-FR')} phrases zh`);

  console.log('Parsing des phrases françaises...');
  const frMap = parseTsv(FILES.fr, 'fra');
  console.log(`  ${frMap.size.toLocaleString('fr-FR')} phrases fr`);

  console.log('Parsing des liens zh ↔ fr...');
  const zhIds = new Set(zhMap.keys());
  const frIds = new Set(frMap.keys());
  const links = parseLinks(FILES.links, zhIds, frIds);
  console.log(`  ${links.length.toLocaleString('fr-FR')} paires trouvées`);

  console.log('Initialisation de jieba...');
  const jieba = Jieba.withDict(dict);

  console.log('Filtrage et segmentation...');
  const seen = new Set<number>();
  const out: OutputSentence[] = [];
  for (const [zhId, frId] of links) {
    if (seen.has(zhId)) continue;
    seen.add(zhId);
    const zh = stripPunctuation(zhMap.get(zhId) ?? '');
    const fr = (frMap.get(frId) ?? '').trim();
    if (!zh || !fr) continue;
    if (!HAN.test(zh)) continue;

    const tokens = jieba.cut(zh).filter((t) => t.trim() && !isPunctuation(t));
    if (tokens.length < 4 || tokens.length > 10) continue;

    out.push({ zh: tokens.join(''), fr, tokens });
  }

  console.log(`  ${out.length.toLocaleString('fr-FR')} phrases retenues (4-10 tokens)`);

  out.sort((a, b) => a.tokens.length - b.tokens.length);

  const payload = {
    version: new Date().toISOString().slice(0, 10),
    source: 'Tatoeba (CC-BY 2.0 FR)',
    sentences: out,
  };

  const outPath = path.join(root, 'public', 'sentences.json');
  writeFileSync(outPath, JSON.stringify(payload));
  const sizeMo = (JSON.stringify(payload).length / 1024 / 1024).toFixed(2);
  console.log(`Écrit ${outPath} (${sizeMo} Mo).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
