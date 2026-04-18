import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIACRITICS: Record<string, Record<number, string>> = {
  a: { 1: 'ā', 2: 'á', 3: 'ǎ', 4: 'à', 5: 'a' },
  e: { 1: 'ē', 2: 'é', 3: 'ě', 4: 'è', 5: 'e' },
  i: { 1: 'ī', 2: 'í', 3: 'ǐ', 4: 'ì', 5: 'i' },
  o: { 1: 'ō', 2: 'ó', 3: 'ǒ', 4: 'ò', 5: 'o' },
  u: { 1: 'ū', 2: 'ú', 3: 'ǔ', 4: 'ù', 5: 'u' },
  'u:': { 1: 'ǖ', 2: 'ǘ', 3: 'ǚ', 4: 'ǜ', 5: 'ü' },
};

const VOWEL_PRIORITY = ['a', 'e', 'o', 'i', 'u', 'u:'];

function pinyinSyllable(raw: string): string {
  const match = raw.match(/^([a-zA-Z:]+?)([1-5])$/);
  if (!match) return raw;
  let base = match[1].toLowerCase();
  const tone = Number(match[2]);
  if (tone === 5) {
    return base.replace('u:', 'ü');
  }
  let target: string | null = null;
  if (base.includes('iu')) {
    target = 'u';
  } else {
    for (const v of VOWEL_PRIORITY) {
      if (base.includes(v)) {
        target = v;
        break;
      }
    }
  }
  if (!target || !(target in DIACRITICS)) return base;
  const replacement = DIACRITICS[target][tone];
  const idx = base.indexOf(target);
  return base.slice(0, idx) + replacement + base.slice(idx + target.length);
}

function prettyPinyin(raw: string): string {
  return raw.split(/\s+/).map(pinyinSyllable).join(' ');
}

function plainPinyin(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/u:/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/;

interface ParsedEntry {
  simplified: string;
  traditional: string;
  pinyin: string;
  pinyinPlain: string;
  definitions: string[];
}

function parse(text: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith('#')) continue;
    const m = LINE_RE.exec(rawLine);
    if (!m) continue;
    const [, trad, simp, pin, defsRaw] = m;
    const definitions = defsRaw
      .split('/')
      .map((d) => d.trim())
      .filter(Boolean);
    if (!definitions.length) continue;
    out.push({
      simplified: simp,
      traditional: trad,
      pinyin: prettyPinyin(pin),
      pinyinPlain: plainPinyin(pin),
      definitions,
    });
  }
  return out;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '..');
  const srcPath = path.join(__dirname, 'cfdict.u8');

  if (!existsSync(srcPath)) {
    console.log('cfdict.u8 non trouvé. Téléchargement depuis chine.in…');
    const url = 'https://chine.in/mandarin/dictionnaire/CFDICT/cfdict.u8';
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Échec téléchargement (${res.status}). Télécharge manuellement :`);
      console.error(`  curl -o scripts/cfdict.u8 ${url}`);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(srcPath, buf);
    console.log(`Téléchargé (${(buf.length / 1024 / 1024).toFixed(1)} Mo).`);
  }

  const text = readFileSync(srcPath, 'utf8');
  const entries = parse(text);
  console.log(`${entries.length.toLocaleString('fr-FR')} entrées parsées.`);

  const versionMatch = text.match(/#!\s*version=([^\n]+)/i);
  const dateMatch = text.match(/#!\s*date=([^\n]+)/i);
  const version = (versionMatch?.[1] ?? dateMatch?.[1] ?? new Date().toISOString().slice(0, 10)).trim();

  const outPath = path.join(root, 'public', 'cedict.json');
  const payload = { version, source: 'CFDICT', entries };
  writeFileSync(outPath, JSON.stringify(payload));
  const sizeMo = ((JSON.stringify(payload).length) / 1024 / 1024).toFixed(1);
  console.log(`Écrit ${outPath} (${sizeMo} Mo, version=${version}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
