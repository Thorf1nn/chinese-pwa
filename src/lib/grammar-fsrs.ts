import { createEmptyCard, FSRS, generatorParameters, Rating, State, type Grade } from 'ts-fsrs';
import { db, type GrammarProgress } from './db';

const params = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true,
  request_retention: 0.9,
  maximum_interval: 365,
});

const scheduler = new FSRS(params);

export type GrammarRating = 1 | 2 | 3 | 4;

interface FsrsCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;
}

function toFsrs(card: GrammarProgress): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

function fromFsrs(base: GrammarProgress, fsrs: FsrsCard): GrammarProgress {
  return {
    ...base,
    due: fsrs.due.getTime(),
    stability: fsrs.stability,
    difficulty: fsrs.difficulty,
    elapsed_days: fsrs.elapsed_days,
    scheduled_days: fsrs.scheduled_days,
    reps: fsrs.reps,
    lapses: fsrs.lapses,
    state: fsrs.state as 0 | 1 | 2 | 3,
    last_review: fsrs.last_review ? fsrs.last_review.getTime() : null,
  };
}

export function buildNewGrammarProgress(itemId: string, level: number): GrammarProgress {
  const empty = createEmptyCard(new Date());
  return {
    itemId,
    level,
    due: empty.due.getTime(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    state: empty.state as 0 | 1 | 2 | 3,
    last_review: empty.last_review ? empty.last_review.getTime() : null,
    createdAt: Date.now(),
  };
}

export function previewGrammarIntervals(
  card: GrammarProgress,
  now = new Date()
): Record<GrammarRating, string> {
  const fsrsCard = toFsrs(card);
  const preview = scheduler.repeat(fsrsCard, now);
  const format = (d: Date): string => {
    const diffMs = d.getTime() - now.getTime();
    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 60) return `${Math.max(minutes, 1)}min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}j`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.round(months / 12)}a`;
  };
  return {
    1: format(preview[Rating.Again].card.due),
    2: format(preview[Rating.Hard].card.due),
    3: format(preview[Rating.Good].card.due),
    4: format(preview[Rating.Easy].card.due),
  };
}

export async function getOrCreateGrammarProgress(
  itemId: string,
  level: number
): Promise<GrammarProgress> {
  const existing = await db.grammarProgress.get(itemId);
  if (existing) return existing;
  const card = buildNewGrammarProgress(itemId, level);
  const plain: GrammarProgress = JSON.parse(JSON.stringify(card));
  await db.grammarProgress.put(plain);
  return plain;
}

export async function submitGrammarReview(
  itemId: string,
  level: number,
  rating: GrammarRating,
  now = new Date()
): Promise<GrammarProgress> {
  const card = await getOrCreateGrammarProgress(itemId, level);
  const wasNew = card.state === 0;
  const result = scheduler.next(toFsrs(card), now, rating as unknown as Grade);
  const updated = fromFsrs(card, result.card);
  const plain: GrammarProgress = JSON.parse(JSON.stringify(updated));
  await db.grammarProgress.put(plain);
  await db.grammarLogs.add({
    itemId,
    rating,
    reviewedAt: now.getTime(),
    elapsed_days: result.log.elapsed_days,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    wasNew,
  });
  return plain;
}
