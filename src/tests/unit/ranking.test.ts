import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateRankings } from '$lib/ranking';
import type { TriLinesEntry } from '$lib/types';

// モックエントリを作成するヘルパー関数
function createEntry(did: string, createdAt: string): TriLinesEntry {
  return {
    uri: `at://${did}/app.bsky.feed.post/xxxx`,
    cid: 'cid',
    authorDid: did,
    lines: [],
    createdAt: createdAt,
    sharedPost: undefined
  };
}

describe('calculateRankings', () => {
  beforeEach(() => {
    // システム時間を固定: 2024-01-10 (水曜日)
    // 週の開始: 1月8日 (月曜日)
    // 注: ranking.tsは日付の境界にローカルタイムを使用します。
    // テスト環境がJSTの場合、UTC時間との変換に注意が必要です。
    vi.useFakeTimers();
    const date = new Date('2024-01-10T12:00:00Z');
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('エントリがない場合は空のランキングを返すこと', () => {
    const result = calculateRankings([]);
    expect(result.total).toHaveLength(0);
    expect(result.streak).toHaveLength(0);
    expect(result.rookie).toHaveLength(0);
    expect(result.weekly).toHaveLength(0);
    expect(result.monthly).toHaveLength(0);
  });

  it('総合ランキングが正しく計算されること', () => {
    const entries = [
      createEntry('did:1', '2024-01-01T10:00:00Z'),
      createEntry('did:1', '2024-01-02T10:00:00Z'),
      createEntry('did:2', '2024-01-01T10:00:00Z'),
    ];

    const result = calculateRankings(entries);

    // did:1 は2つのエントリ（2日分）で1位
    // did:2 は1つのエントリ（1日分）で2位
    expect(result.total).toHaveLength(2);
    expect(result.total[0]).toMatchObject({ did: 'did:1', count: 2, rank: 1 });
    expect(result.total[1]).toMatchObject({ did: 'did:2', count: 1, rank: 2 });
  });

  it('連続投稿（ストリーク）が正しく計算されること', () => {
    const entries = [
      createEntry('did:streak', '2024-01-10T10:00:00Z'), // 今日
      createEntry('did:streak', '2024-01-09T10:00:00Z'), // 昨日
      createEntry('did:streak', '2024-01-08T10:00:00Z'), // 一昨日
      createEntry('did:streak', '2024-01-06T10:00:00Z'), // 欠け（1月7日がない）
      createEntry('did:streak', '2024-01-05T10:00:00Z'), // → ooxoooパターン
    ];

    const result = calculateRankings(entries);

    // ストリーク: 1月8日, 9日, 10日 -> 3日間
    expect(result.streak[0]).toMatchObject({ did: 'did:streak', count: 3 });
  });

  it('連続投稿（ストリーク）が正しく計算されること2', () => {
    const entries = [
      createEntry('did:streak', '2024-01-10T10:00:00Z'), // 今日
      createEntry('did:streak', '2024-01-09T10:00:00Z'), // 昨日
      createEntry('did:streak', '2024-01-07T10:00:00Z'), // 欠け（1月8日がない）
      createEntry('did:streak', '2024-01-06T10:00:00Z'), // 
      createEntry('did:streak', '2024-01-05T10:00:00Z'), // → oooxooパターン
    ];

    const result = calculateRankings(entries);

    // ストリーク: 1月8日, 9日, 10日 -> 3日間
    expect(result.streak[0]).toMatchObject({ did: 'did:streak', count: 3 });
  });

  it('初投稿が5日以内の場合、ルーキーとして識別されること', () => {
    const rookieEntries = [
      createEntry('did:rookie', '2024-01-08T10:00:00Z'),
    ];
    const oldUserEntries = [
      createEntry('did:old', '2024-01-01T10:00:00Z'),
      createEntry('did:old', '2024-01-10T10:00:00Z'),
    ];

    const result = calculateRankings([...rookieEntries, ...oldUserEntries]);

    expect(result.rookie).toHaveLength(1);
    expect(result.rookie[0].did).toBe('did:rookie');
  });

  it('週間ランキング（月-日）が正しく計算されること', () => {
    // 週の開始は1月8日（月）
    const entries = [
      createEntry('did:weekly', '2024-01-10T10:00:00Z'), // 水（週内）
      createEntry('did:weekly', '2024-01-09T10:00:00Z'), // 火（週内）
      // 1月7日は前の週。
      // 2024-01-07T12:00:00Z はJSTでも1月7日21:00なので安全に前の週
      createEntry('did:weekly', '2024-01-07T12:00:00Z'),
    ];

    const result = calculateRankings(entries);

    // 2件カウントされるべき（1月9日、1月10日）
    expect(result.weekly[0]).toMatchObject({ did: 'did:weekly', count: 2 });
  });

  it('月間ランキング（1日〜末日）が正しく計算されること', () => {
    // 月の開始は1月1日
    const entries = [
      createEntry('did:monthly', '2024-01-10T10:00:00Z'),
      createEntry('did:monthly', '2024-01-01T10:00:00Z'), // 月内
      createEntry('did:monthly', '2023-12-31T12:00:00Z'), // 前月
    ];

    const result = calculateRankings(entries);

    expect(result.monthly[0]).toMatchObject({ did: 'did:monthly', count: 2 });
  });

  it('同率順位が正しく処理されること', () => {
    const entries = [
      createEntry('did:A', '2024-01-10T10:00:00Z'),
      createEntry('did:A', '2024-01-09T10:00:00Z'), // 2件

      createEntry('did:B', '2024-01-10T10:00:00Z'),
      createEntry('did:B', '2024-01-09T10:00:00Z'), // 2件

      createEntry('did:C', '2024-01-10T10:00:00Z'), // 1件
    ];

    const result = calculateRankings(entries);

    const a = result.total.find(r => r.did === 'did:A')!;
    const b = result.total.find(r => r.did === 'did:B')!;
    const c = result.total.find(r => r.did === 'did:C')!;

    expect(a.rank).toBe(1);
    expect(b.rank).toBe(1);
    expect(c.rank).toBe(3);
  });

  it('ユーザーバッジが正しく付与されること', () => {
    // 現在時刻: 2024-01-10 (設定済み)

    // Streak User: Active (本日〜3日前 = 4日間連続) -> 🔥
    // 10(本日), 9, 8, 7 -> 4 days
    const streakUser = [
      createEntry('did:streakBG', '2024-01-10T10:00:00Z'),
      createEntry('did:streakBG', '2024-01-09T10:00:00Z'),
      createEntry('did:streakBG', '2024-01-08T10:00:00Z'),
      createEntry('did:streakBG', '2024-01-07T10:00:00Z'),
    ];

    // Rookie User: 初投稿が5日以内 -> 🔰
    // 2024-01-10の5日前は2024-01-05
    // 2024-01-06に初投稿
    const rookieUser = [
      createEntry('did:rookieBG', '2024-01-06T10:00:00Z'),
      createEntry('did:rookieBG', '2024-01-07T10:00:00Z'),
    ];

    // Streak & Rookie -> Priority Streak (🔥)
    // 10, 9, 8, 7. Streak 4.
    // First post 7. Within 5 days (5th).
    const bothUser = [
      createEntry('did:both', '2024-01-10T10:00:00Z'),
      createEntry('did:both', '2024-01-09T10:00:00Z'),
      createEntry('did:both', '2024-01-08T10:00:00Z'),
      createEntry('did:both', '2024-01-07T10:00:00Z'),
    ];

    // Inactive Streak User -> No Badge
    // 8, 7, 6, 5. Streak 4. Last post 8. Today 10. Gap > 1.
    const inactiveUser = [
      createEntry('did:inactive', '2024-01-08T10:00:00Z'),
      createEntry('did:inactive', '2024-01-07T10:00:00Z'),
      createEntry('did:inactive', '2024-01-06T10:00:00Z'),
      createEntry('did:inactive', '2024-01-05T10:00:00Z'),
    ];

    // Regular User -> No Badge
    const regularUser = [
      createEntry('did:regular', '2024-01-02T10:00:00Z'),
      createEntry('did:regular', '2024-01-10T10:00:00Z'),
    ];

    const result = calculateRankings([
      ...streakUser,
      ...rookieUser,
      ...bothUser,
      ...inactiveUser,
      ...regularUser
    ]);

    expect(result.badges['did:streakBG']).toBe('🔥');
    expect(result.badges['did:rookieBG']).toBe('🔰');
    expect(result.badges['did:both']).toBe('🔥');
    expect(result.badges['did:inactive']).toBeUndefined();
    expect(result.badges['did:regular']).toBeUndefined();
  });
});
