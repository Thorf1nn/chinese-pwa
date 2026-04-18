import { db, type Card, type ReviewLog, type SentenceLog } from './db';

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
  const logs = await db.sentenceLogs.where('reviewedAt').aboveOrEqual(since).toArray();
  const attempted = logs.length;
  const correct = logs.filter((l) => l.rating >= 3).length;
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
  const cards = await db.sentenceCards.toArray();
  const logs = await db.sentenceLogs.toArray();

  const stats = new Map<string, { attempts: number; failures: number; lastReviewedAt: number }>();
  for (const l of logs) {
    const s = stats.get(l.zh) ?? { attempts: 0, failures: 0, lastReviewedAt: 0 };
    s.attempts += 1;
    if (l.rating === 1) s.failures += 1;
    if (l.reviewedAt > s.lastReviewedAt) s.lastReviewedAt = l.reviewedAt;
    stats.set(l.zh, s);
  }

  return cards
    .filter((c) => c.lapses >= 2 || c.difficulty > 7)
    .map((c) => {
      const s = stats.get(c.zh);
      return {
        zh: c.zh,
        fr: c.fr,
        failures: s?.failures ?? c.lapses,
        attempts: s?.attempts ?? c.reps,
        lastReviewedAt: s?.lastReviewedAt ?? c.last_review ?? c.createdAt,
      };
    })
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
  const sentenceLogs = await db.sentenceLogs
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
  retention: number;
}

export async function getSentencesGlobalStats(): Promise<SentencesGlobalStats> {
  const cards = await db.sentenceCards.count();
  const logs = await db.sentenceLogs.toArray();
  const correct = logs.filter((l) => l.rating >= 3).length;
  const retention = logs.length > 0 ? Math.round((correct / logs.length) * 100) : 0;
  return {
    uniqueSeen: cards,
    totalAttempts: logs.length,
    successRate: retention,
    retention,
  };
}

export async function logSentenceReview(_entry: unknown): Promise<void> {
  // Legacy no-op : les reviews de phrases passent maintenant par submitSentenceReview.
}

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
