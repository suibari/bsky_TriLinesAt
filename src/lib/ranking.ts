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

    // If latest post is older than yesterday, streak is 0
    // (Assuming we strictly require today or yesterday to trigger a "current" streak)
    if (latestDate !== today && latestDate !== yesterday) {
      streakRanking.push({ rank: 0, did, count: 0, lastPostDate: latestDate });
      continue;
    }

    let streak = 0;
    // Check continuity
    // e.g. [2024-01-05, 2024-01-04, 2024-01-02]
    // 0: 05 - 1 = 04 (match index 1? yes) -> streak++
    // 1: 04 - 1 = 03 (match index 2? no, 02) -> break

    // We treat the "head" of the streak as the anchor.
    // If latest is today, we count backwards from today.
    // If latest is yesterday, we count backwards from yesterday.

    let currentDateStr = latestDate;
    streak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const checkDate = new Date(currentDateStr);
      checkDate.setDate(checkDate.getDate() - 1); // Expected previous day
      const expectedPrevStr = getDid(checkDate.toISOString());

      if (uniqueDates[i] === expectedPrevStr) {
        streak++;
        currentDateStr = expectedPrevStr;
      } else {
        break;
      }
    }

    streakRanking.push({ rank: 0, did, count: streak, lastPostDate: latestDate });
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
