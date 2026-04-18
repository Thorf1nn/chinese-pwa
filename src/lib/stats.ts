import { db, type Card, type ReviewLog, type SentenceReview } from './db';

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface CardsTodaySummary {
  reviewsDone: number;
  correctRate: number;
  dueReviewsLeft: number;
  newLeft: number;
}

export async function getCardsTodaySummary(
  dueReviewsLeft: number,
  newLeft: number
): Promise<CardsTodaySummary> {
  const since = startOfDay();
  const logs = await db.reviews.where('reviewedAt').aboveOrEqual(since).toArray();
  const total = logs.length;
  const correct = logs.filter((l) => l.rating >= 3).length;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    reviewsDone: total,
    correctRate: rate,
    dueReviewsLeft,
    newLeft,
  };
}

export interface SentencesTodaySummary {
  attempted: number;
  successRate: number;
  inQueue: number;
}

export async function getSentencesTodaySummary(inQueue: number): Promise<SentencesTodaySummary> {
  const since = startOfDay();
  const logs = await db.sentenceReviews.where('reviewedAt').aboveOrEqual(since).toArray();
  const attempted = logs.filter((l) => l.result !== 'skipped').length;
  const correct = logs.filter((l) => l.result === 'correct').length;
  const rate = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  return { attempted, successRate: rate, inQueue };
}

export interface LevelProgress {
  level: string;
  total: number;
  mastered: number;
  learning: number;
  difficult: number;
  unseen: number;
}

export function computeLevelProgress(
  cards: Card[],
  levels: Array<{ id: string; total: number }>
): LevelProgress[] {
  return levels.map(({ id, total }) => {
    const withTag = cards.filter((c) => c.tags.includes(id));
    const mastered = withTag.filter((c) => c.state === 2 && c.stability > 21).length;
    const difficult = withTag.filter((c) => c.lapses >= 2 || c.difficulty > 7).length;
    const learning = withTag.filter(
      (c) =>
        (c.state === 1 || c.state === 3 || (c.state === 2 && c.stability <= 21)) &&
        c.lapses < 2 &&
        c.difficulty <= 7
    ).length;
    const seenTotal = mastered + difficult + learning + withTag.filter((c) => c.state === 0).length;
    const unseen = Math.max(0, total - seenTotal);
    return { level: id, total, mastered, learning, difficult, unseen };
  });
}

export interface LeechEntry {
  card: Card;
  reason: 'lapses' | 'difficulty' | 'both';
}

export function findLeeches(cards: Card[], limit = 10): LeechEntry[] {
  const candidates = cards
    .filter((c) => c.lapses >= 2 || c.difficulty > 7)
    .map<LeechEntry>((c) => ({
      card: c,
      reason: c.lapses >= 2 && c.difficulty > 7 ? 'both' : c.lapses >= 2 ? 'lapses' : 'difficulty',
    }))
    .sort((a, b) => {
      if (b.card.lapses !== a.card.lapses) return b.card.lapses - a.card.lapses;
      return b.card.difficulty - a.card.difficulty;
    });
  return candidates.slice(0, limit);
}

export interface SentenceLeech {
  zh: string;
  fr: string;
  failures: number;
  attempts: number;
  lastReviewedAt: number;
}

export async function findSentenceLeeches(limit = 10): Promise<SentenceLeech[]> {
  const all = await db.sentenceReviews.toArray();
  const map = new Map<string, SentenceLeech>();
  for (const r of all) {
    if (r.result === 'skipped') continue;
    const existing = map.get(r.zh);
    if (existing) {
      existing.attempts += 1;
      if (r.result === 'wrong') existing.failures += 1;
      if (r.reviewedAt > existing.lastReviewedAt) existing.lastReviewedAt = r.reviewedAt;
    } else {
      map.set(r.zh, {
        zh: r.zh,
        fr: r.fr,
        failures: r.result === 'wrong' ? 1 : 0,
        attempts: 1,
        lastReviewedAt: r.reviewedAt,
      });
    }
  }
  return Array.from(map.values())
    .filter((s) => s.failures >= 2)
    .sort((a, b) => {
      if (b.failures !== a.failures) return b.failures - a.failures;
      return b.lastReviewedAt - a.lastReviewedAt;
    })
    .slice(0, limit);
}

export interface HeatmapDay {
  date: string;
  count: number;
  cards: number;
  sentences: number;
}

export async function buildHeatmap(days = 90): Promise<HeatmapDay[]> {
  const earliest = startOfDay() - (days - 1) * 86400000;
  const cardLogs = await db.reviews.where('reviewedAt').aboveOrEqual(earliest).toArray();
  const sentenceLogs = await db.sentenceReviews
    .where('reviewedAt')
    .aboveOrEqual(earliest)
    .toArray();

  const cardMap = new Map<string, number>();
  for (const l of cardLogs) {
    const key = dateKey(startOfDay(l.reviewedAt));
    cardMap.set(key, (cardMap.get(key) ?? 0) + 1);
  }
  const sentenceMap = new Map<string, number>();
  for (const l of sentenceLogs) {
    if (l.result === 'skipped') continue;
    const key = dateKey(startOfDay(l.reviewedAt));
    sentenceMap.set(key, (sentenceMap.get(key) ?? 0) + 1);
  }

  const out: HeatmapDay[] = [];
  for (let i = 0; i < days; i++) {
    const ts = earliest + i * 86400000;
    const key = dateKey(ts);
    const cards = cardMap.get(key) ?? 0;
    const sentences = sentenceMap.get(key) ?? 0;
    out.push({ date: key, count: cards + sentences, cards, sentences });
  }
  return out;
}

export function computeStreak(heatmap: HeatmapDay[]): number {
  let streak = 0;
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i].count > 0) streak++;
    else break;
  }
  return streak;
}

export interface CardsGlobalStats {
  totalCards: number;
  totalReviews: number;
  retention: number;
  addedThisWeek: number;
}

export async function getCardsGlobalStats(cards: Card[]): Promise<CardsGlobalStats> {
  const totalReviews = await db.reviews.count();
  let correct = 0;
  let total = 0;
  await db.reviews.each((r: ReviewLog) => {
    total++;
    if (r.rating >= 3) correct++;
  });
  const retention = total > 0 ? Math.round((correct / total) * 100) : 0;

  const weekAgo = startOfDay() - 6 * 86400000;
  const addedThisWeek = cards.filter((c) => c.createdAt >= weekAgo).length;

  return {
    totalCards: cards.length,
    totalReviews,
    retention,
    addedThisWeek,
  };
}

export interface SentencesGlobalStats {
  uniqueSeen: number;
  totalAttempts: number;
  successRate: number;
}

export async function getSentencesGlobalStats(): Promise<SentencesGlobalStats> {
  const all = await db.sentenceReviews.toArray();
  const realAttempts = all.filter((l) => l.result !== 'skipped');
  const correct = realAttempts.filter((l) => l.result === 'correct').length;
  const unique = new Set(realAttempts.map((l) => l.zh));
  return {
    uniqueSeen: unique.size,
    totalAttempts: realAttempts.length,
    successRate: realAttempts.length > 0 ? Math.round((correct / realAttempts.length) * 100) : 0,
  };
}

export async function logSentenceReview(entry: Omit<SentenceReview, 'id'>): Promise<void> {
  await db.sentenceReviews.add(entry as SentenceReview);
}

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
