import type { TriLinesEntry } from './types';

export interface RankingItem {
  rank: number;
  did: string;
  count: number;
  lastPostDate?: string;
}

export interface Rankings {
  total: RankingItem[];
  streak: RankingItem[];
}

// Helper to format date as YYYY-MM-DD in local time
function getDid(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function assignRanks(items: RankingItem[]) {
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && items[i].count === items[i - 1].count) {
      items[i].rank = items[i - 1].rank;
    } else {
      items[i].rank = i + 1;
    }
  }
}

export function calculateRankings(entries: TriLinesEntry[]): Rankings {
  const users: Record<string, TriLinesEntry[]> = {};

  // Group by user
  for (const entry of entries) {
    if (!users[entry.authorDid]) {
      users[entry.authorDid] = [];
    }
    users[entry.authorDid].push(entry);
  }

  const totalRanking: RankingItem[] = [];
  const streakRanking: RankingItem[] = [];

  const today = getDid(new Date().toISOString());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getDid(yesterdayDate.toISOString());

  for (const did in users) {
    const userEntries = users[did];

    // 2. Streak & Total (Unique Days)
    const uniqueDates = Array.from(new Set(
      userEntries.map(e => getDid(e.createdAt))
    )).sort().reverse(); // Descending YYYY-MM-DD

    // 1. Total Count (Unique Days)
    // Initialize rank with 0, will be assigned later
    totalRanking.push({
      rank: 0,
      did,
      count: uniqueDates.length,
      lastPostDate: userEntries[0]?.createdAt
    });

    if (uniqueDates.length === 0) {
      streakRanking.push({ rank: 0, did, count: 0 });
      continue;
    }

    const latestDate = uniqueDates[0];

    // Calculate Max Historical Streak
    let maxStreak = 0;
    let currentStreak = 0;
    let prevDateStr: string | null = null;

    // Iterate through sorted dates (descending)
    // Actually, to count consecutive easily, let's look at them.
    // [2024-01-05, 2024-01-04, 2024-01-01]

    // Iterate and detect breaks.
    // For simple max streak finding, we can just iterate.

    for (let i = 0; i < uniqueDates.length; i++) {
      const dateStr = uniqueDates[i];

      if (prevDateStr === null) {
        currentStreak = 1;
      } else {
        const date = new Date(dateStr);
        const prev = new Date(prevDateStr);
        // Diff in days. prev is newer (descending order)
        // prev - date
        const diffTime = prev.getTime() - date.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak++;
        } else {
          // Break in streak
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
          currentStreak = 1;
        }
      }
      prevDateStr = dateStr;
    }
    // Final check for the last running streak
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }

    streakRanking.push({ rank: 0, did, count: maxStreak, lastPostDate: latestDate });
  }

  // Sort rankings
  totalRanking.sort((a, b) => b.count - a.count);
  streakRanking.sort((a, b) => b.count - a.count);

  // Assign Ranks (Standard Competition Ranking)
  assignRanks(totalRanking);
  assignRanks(streakRanking);

  return {
    total: totalRanking,
    streak: streakRanking
  };
}
