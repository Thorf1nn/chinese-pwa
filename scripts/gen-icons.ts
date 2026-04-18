import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

const PLACEHOLDER_PNG = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C63F8CF' +
    'C00000000300010000000000000049454E44AE426082',
  'hex'
);

for (const size of [192, 512]) {
  writeFileSync(path.join(publicDir, `pwa-${size}.png`), PLACEHOLDER_PNG);
}
writeFileSync(path.join(publicDir, 'pwa-512-maskable.png'), PLACEHOLDER_PNG);
writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), PLACEHOLDER_PNG);

console.log('Icônes PWA placeholder générées. Remplace par des PNG propres avant prod.');
