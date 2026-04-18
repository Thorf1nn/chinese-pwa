import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SOURCES: Record<string, string> = {
  hsk1: 'https://raw.githubusercontent.com/glxxyz/hskhsk.com/master/data/lists/HSK%20Official%202012%20L1.txt',
  hsk2: 'https://raw.githubusercontent.com/glxxyz/hskhsk.com/master/data/lists/HSK%20Official%202012%20L2.txt',
  hsk3: 'https://raw.githubusercontent.com/glxxyz/hskhsk.com/master/data/lists/HSK%20Official%202012%20L3.txt',
  hsk4: 'https://raw.githubusercontent.com/glxxyz/hskhsk.com/master/data/lists/HSK%20Official%202012%20L4.txt',
  hsk5: 'https://raw.githubusercontent.com/glxxyz/hskhsk.com/master/data/lists/HSK%20Official%202012%20L5.txt',
  hsk6: 'https://raw.githubusercontent.com/glxxyz/hskhsk.com/master/data/lists/HSK%20Official%202012%20L6.txt',
};

async function fetchList(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = await res.text();
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/[\s\t]/)[0])
    .filter(Boolean);
}

async function main() {
  const payload: { version: string; source: string; levels: Record<string, string[]> } = {
    version: new Date().toISOString().slice(0, 10),
    source: 'HSK 2.0 (2012) via glxxyz/hskhsk.com',
    levels: {},
  };

  for (const [level, url] of Object.entries(SOURCES)) {
    process.stdout.write(`Téléchargement ${level}... `);
    const words = await fetchList(url);
    payload.levels[level] = words;
    console.log(`${words.length} mots`);
  }

  const outPath = path.join(root, 'public', 'hsk.json');
  writeFileSync(outPath, JSON.stringify(payload));
  const sizeKo = (JSON.stringify(payload).length / 1024).toFixed(1);
  console.log(`Écrit ${outPath} (${sizeKo} Ko).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
