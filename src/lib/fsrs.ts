import { createEmptyCard, FSRS, generatorParameters, Rating, State, type Grade } from 'ts-fsrs';
import type { Card } from './db';

const params = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true,
  request_retention: 0.9,
  maximum_interval: 365,
});

export const scheduler = new FSRS(params);

export type ReviewRating = 1 | 2 | 3 | 4;

export const RATING_LABELS: Record<ReviewRating, { label: string; color: string }> = {
  1: { label: 'À revoir', color: 'bg-red-600 hover:bg-red-500' },
  2: { label: 'Difficile', color: 'bg-orange-500 hover:bg-orange-400' },
  3: { label: 'Bon', color: 'bg-emerald-600 hover:bg-emerald-500' },
  4: { label: 'Facile', color: 'bg-sky-600 hover:bg-sky-500' },
};

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

function toFsrs(card: Card): FsrsCard {
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

function fromFsrs(base: Card, fsrs: FsrsCard): Card {
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

export function buildNewCard(
  overrides: Pick<Card, 'id' | 'simplified' | 'pinyin' | 'definitions'> & {
    sentences?: Card['sentences'];
    tags?: string[];
  }
): Card {
  const empty = createEmptyCard(new Date());
  return {
    id: overrides.id,
    simplified: overrides.simplified,
    pinyin: overrides.pinyin,
    definitions: overrides.definitions,
    sentences: overrides.sentences ?? [],
    tags: overrides.tags ?? [],
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

export interface ReviewResult {
  card: Card;
  log: {
    rating: ReviewRating;
    reviewedAt: number;
    elapsed_days: number;
    stability: number;
    difficulty: number;
  };
}

export function reviewCard(card: Card, rating: ReviewRating, now = new Date()): ReviewResult {
  const fsrsCard = toFsrs(card);
  const result = scheduler.next(fsrsCard, now, rating as unknown as Grade);
  const updated = fromFsrs(card, result.card);
  return {
    card: updated,
    log: {
      rating,
      reviewedAt: now.getTime(),
      elapsed_days: result.log.elapsed_days,
      stability: result.card.stability,
      difficulty: result.card.difficulty,
    },
  };
}

export function previewIntervals(card: Card, now = new Date()): Record<ReviewRating, string> {
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
