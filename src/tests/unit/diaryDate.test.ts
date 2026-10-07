import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDiaryDateKey } from '$lib/diaryDate';
import { calculateRankings } from '$lib/ranking';
import type { TriLinesEntry } from '$lib/types';

afterEach(() => vi.useRealTimers());

describe('noon diary cutoff (local time)', () => {
  it.each([
    ['2026-10-08T23:59:59', '2026-10-08'],
    ['2026-10-09T00:00:00', '2026-10-08'],
    ['2026-10-09T11:59:59.999', '2026-10-08'],
    ['2026-10-09T12:00:00', '2026-10-09'],
    ['2026-01-01T01:00:00', '2025-12-31'],
    ['2024-03-01T11:59:59', '2024-02-29'],
    ['2026-03-08T11:59:59', '2026-03-07'],
    ['2026-11-01T11:59:59', '2026-10-31'],
  ])('%s belongs to %s', (time, expected) => {
    expect(getDiaryDateKey(new Date(time))).toBe(expected);
  });

  it('keeps late posts together and switches weekly/monthly totals at noon', () => {
    vi.useFakeTimers();
    const entries = ['2026-05-30T23:00:00', '2026-05-31T23:00:00', '2026-06-01T11:59:59']
      .map(createdAt => ({ authorDid: 'did:test', createdAt } as TriLinesEntry));
    vi.setSystemTime(new Date('2026-06-01T11:59:59'));
    const before = calculateRankings(entries);
    expect(before.total[0].count).toBe(2);
    expect(before.streak[0]).toMatchObject({ count: 2, lastPostDate: '2026-05-31' });
    expect(before.weekly[0].count).toBe(2);
    expect(before.monthly[0].count).toBe(2);
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    const after = calculateRankings(entries);
    expect(after.streak[0].count).toBe(2);
    expect(after.weekly).toEqual([]);
    expect(after.monthly).toEqual([]);
    entries.push({ authorDid: 'did:test', createdAt: '2026-06-01T12:00:00' } as TriLinesEntry);
    const posted = calculateRankings(entries);
    expect(posted.streak[0].count).toBe(3);
    expect(posted.weekly[0].count).toBe(1);
    expect(posted.monthly[0].count).toBe(1);
  });
});
