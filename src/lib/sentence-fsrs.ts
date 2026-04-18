import { createEmptyCard, FSRS, generatorParameters, Rating, State, type Grade } from 'ts-fsrs';
import { db, type SentenceCard } from './db';

const params = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true,
  request_retention: 0.9,
  maximum_interval: 365,
});

const scheduler = new FSRS(params);

export type SentenceRating = 1 | 2 | 3 | 4;

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

function toFsrs(card: SentenceCard): FsrsCard {
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

function fromFsrs(base: SentenceCard, fsrs: FsrsCard): SentenceCard {
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

export function buildNewSentenceCard(zh: string, fr: string, tokens: string[]): SentenceCard {
  const empty = createEmptyCard(new Date());
  return {
    zh,
    fr,
    tokens,
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

export function reviewSentenceCard(
  card: SentenceCard,
  rating: SentenceRating,
  now = new Date()
) {
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

export function previewSentenceIntervals(
  card: SentenceCard,
  now = new Date()
): Record<SentenceRating, string> {
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

export async function getOrCreateSentenceCard(
  zh: string,
  fr: string,
  tokens: string[]
): Promise<SentenceCard> {
  const existing = await db.sentenceCards.get(zh);
  if (existing) return existing;
  const card = buildNewSentenceCard(zh, fr, tokens);
  await db.sentenceCards.put(card);
  return card;
}

export async function submitSentenceReview(
  zh: string,
  fr: string,
  tokens: string[],
  rating: SentenceRating
) {
  const card = await getOrCreateSentenceCard(zh, fr, tokens);
  const wasNew = card.state === 0;
  const { card: updated, log } = reviewSentenceCard(card, rating);
  await db.sentenceCards.put(updated);
  await db.sentenceLogs.add({ zh, ...log, wasNew });
  return updated;
}
