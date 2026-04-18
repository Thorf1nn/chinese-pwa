import { db, type Card, type ReviewLog } from './db';

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface TodaySummary {
  reviewsDone: number;
  correctRate: number;
  dueReviewsLeft: number;
  newLeft: number;
}

export async function getTodaySummary(
  cards: Card[],
  dueReviewsLeft: number,
  newLeft: number
): Promise<TodaySummary> {
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

export interface HeatmapDay {
  date: string;
  count: number;
}

export async function buildHeatmap(days = 90): Promise<HeatmapDay[]> {
  const earliest = startOfDay() - (days - 1) * 86400000;
  const logs = await db.reviews.where('reviewedAt').aboveOrEqual(earliest).toArray();
  const counts = new Map<string, number>();
  for (const l of logs) {
    const key = dateKey(startOfDay(l.reviewedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: HeatmapDay[] = [];
  for (let i = 0; i < days; i++) {
    const ts = earliest + i * 86400000;
    const key = dateKey(ts);
    out.push({ date: key, count: counts.get(key) ?? 0 });
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

export interface GlobalStats {
  totalCards: number;
  totalReviews: number;
  retention: number;
  addedThisWeek: number;
}

export async function getGlobalStats(cards: Card[]): Promise<GlobalStats> {
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

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
