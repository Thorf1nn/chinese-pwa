import type { Card } from './db';

export type QuizFace = 'hanzi' | 'pinyin' | 'french';

export interface QuizQuestion {
  target: Card;
  visibleFace: QuizFace;
  hiddenFaces: QuizFace[];
  optionsByFace: Record<QuizFace, Card[]>;
  correctId: string;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDistractors(
  target: Card,
  pool: Card[],
  count = 3,
  exclude: Set<string> = new Set()
): Card[] {
  const sameTag = pool.filter(
    (c) =>
      c.id !== target.id &&
      !exclude.has(c.id) &&
      c.tags.some((t) => target.tags.includes(t))
  );
  const different = pool.filter(
    (c) =>
      c.id !== target.id &&
      !exclude.has(c.id) &&
      !c.tags.some((t) => target.tags.includes(t))
  );

  const chosen: Card[] = [];
  chosen.push(...shuffle(sameTag).slice(0, count));
  if (chosen.length < count) {
    chosen.push(...shuffle(different).slice(0, count - chosen.length));
  }
  return chosen.slice(0, count);
}

const FACES: QuizFace[] = ['hanzi', 'pinyin', 'french'];

export function buildQuizQuestion(target: Card, pool: Card[]): QuizQuestion | null {
  const visibleFace = FACES[Math.floor(Math.random() * FACES.length)];
  const hiddenFaces = FACES.filter((f) => f !== visibleFace);

  const firstDistractors = pickDistractors(target, pool, 3);
  if (firstDistractors.length < 3) return null;

  const used = new Set(firstDistractors.map((c) => c.id));
  const secondDistractors = pickDistractors(target, pool, 3, used);

  const optionsByFace = {
    [visibleFace]: [target],
    [hiddenFaces[0]]: shuffle([target, ...firstDistractors]),
    [hiddenFaces[1]]: shuffle([
      target,
      ...(secondDistractors.length === 3 ? secondDistractors : firstDistractors),
    ]),
  } as Record<QuizFace, Card[]>;

  return {
    target,
    visibleFace,
    hiddenFaces,
    optionsByFace,
    correctId: target.id,
  };
}

export function faceValue(card: Card, face: QuizFace): string {
  if (face === 'hanzi') return card.simplified;
  if (face === 'pinyin') return card.pinyin;
  return card.definitions.slice(0, 2).join(' · ');
}

export function faceLabel(face: QuizFace): string {
  if (face === 'hanzi') return 'caractère';
  if (face === 'pinyin') return 'pinyin';
  return 'traduction';
}

export type QuizAnswerCount = 0 | 1 | 2;

export function scoreToRating(correct: QuizAnswerCount): 1 | 2 | 3 | 4 {
  if (correct === 0) return 1;
  if (correct === 1) return 2;
  return 3;
}
