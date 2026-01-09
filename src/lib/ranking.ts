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
  rookie: RankingItem[];
  weekly: RankingItem[];
  monthly: RankingItem[];
  badges: Record<string, string>;
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
  const now = new Date();

  // Normalize Today/Yesterday strings
  const todayStr = getDid(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getDid(yesterday.toISOString());

  // 1. Weekly Start (Monday of current week)
  // getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
  const day = now.getDay();
  const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(diffToMon);
  startOfWeek.setHours(0, 0, 0, 0);

  // 2. Monthly Start (1st of current month)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 3. Rookie Cutoff (5 days ago)
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(now.getDate() - 5);


  // Group by user
  for (const entry of entries) {
    if (!users[entry.authorDid]) {
      users[entry.authorDid] = [];
    }
    users[entry.authorDid].push(entry);
  }

  const totalRanking: RankingItem[] = [];
  const streakRanking: RankingItem[] = [];
  const rookieRanking: RankingItem[] = [];
  const weeklyRanking: RankingItem[] = [];
  const monthlyRanking: RankingItem[] = [];
  const badges: Record<string, string> = {};

  for (const did in users) {
    const userEntries = users[did];

    // Sort ascending for logic checks (oldest first)
    userEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const firstPostDate = new Date(userEntries[0].createdAt);
    const lastPostDate = userEntries[userEntries.length - 1].createdAt;

    const uniqueDates = Array.from(new Set(
      userEntries.map(e => getDid(e.createdAt))
    )).sort().reverse(); // Descending YYYY-MM-DD for Streak/Total

    // --- Existing Total & Streak (Keep for backward compat or if needed) ---
    // Total (Unique Days)
    totalRanking.push({
      rank: 0,
      did,
      count: uniqueDates.length,
      lastPostDate
    });

    // Streak Calculation (Avg Max Streak Logic + Current Streak Logic)
    let maxStreak = 0;
    let currentStreak = 0;
    let prevDateStr: string | null = null;
    let currentActiveStreak = 0;

    // Calculate Max Steak (History)
    for (const dateStr of uniqueDates) { // iterating descending
      if (prevDateStr === null) {
        currentStreak = 1;
      } else {
        const d = new Date(dateStr);
        const p = new Date(prevDateStr);
        const diffDays = Math.ceil((p.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          if (currentStreak > maxStreak) maxStreak = currentStreak;
          currentStreak = 1;
        }
      }
      prevDateStr = dateStr;
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
    streakRanking.push({ rank: 0, did, count: maxStreak, lastPostDate: uniqueDates[0] });

    // Calculate Current Active Streak (Ending Today or Yesterday)
    if (uniqueDates.length > 0) {
      const lastActionDate = uniqueDates[0];
      if (lastActionDate === todayStr || lastActionDate === yesterdayStr) {
        currentActiveStreak = 1;
        let prev = lastActionDate;
        for (let i = 1; i < uniqueDates.length; i++) {
          const current = uniqueDates[i];
          const d = new Date(current);
          const p = new Date(prev);
          const diffDays = Math.ceil((p.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            currentActiveStreak++;
            prev = current;
          } else {
            break;
          }
        }
      }
    }

    // --- New Rankings ---

    // 1. Rookie: First post within 5 days?
    let isRookie = false;
    if (firstPostDate >= fiveDaysAgo) {
      isRookie = true;
      rookieRanking.push({
        rank: 0,
        did,
        count: uniqueDates.length,
        lastPostDate
      });
    }

    // Badge Logic
    // 🔥：Current Stream >= 4
    // 🔰：Rookie
    // Priority: 🔥 > 🔰
    if (currentActiveStreak >= 4) {
      badges[did] = '🔥';
    } else if (isRookie) {
      badges[did] = '🔰';
    }

    // Helper for string comparison
    const startOfWeekStr = getDid(startOfWeek.toISOString());
    const startOfMonthStr = getDid(startOfMonth.toISOString());

    // 2. Weekly: Count unique dates >= startOfWeek
    const weeklyCount = uniqueDates.filter(d => d >= startOfWeekStr).length;
    if (weeklyCount > 0) {
      weeklyRanking.push({
        rank: 0,
        did,
        count: weeklyCount,
        lastPostDate
      });
    }

    // 3. Monthly: Count unique dates >= startOfMonth
    const monthlyCount = uniqueDates.filter(d => d >= startOfMonthStr).length;
    if (monthlyCount > 0) {
      monthlyRanking.push({
        rank: 0,
        did,
        count: monthlyCount,
        lastPostDate
      });
    }
  }

  // Sort and Assign Ranks
  totalRanking.sort((a, b) => b.count - a.count);
  streakRanking.sort((a, b) => b.count - a.count);
  rookieRanking.sort((a, b) => b.count - a.count);
  weeklyRanking.sort((a, b) => b.count - a.count);
  monthlyRanking.sort((a, b) => b.count - a.count);

  assignRanks(totalRanking);
  assignRanks(streakRanking);
  assignRanks(rookieRanking);
  assignRanks(weeklyRanking);
  assignRanks(monthlyRanking);

  return {
    total: totalRanking,
    streak: streakRanking,
    rookie: rookieRanking,
    weekly: weeklyRanking,
    monthly: monthlyRanking,
    badges
  };
}
