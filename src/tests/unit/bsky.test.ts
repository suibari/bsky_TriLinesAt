import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// モックの定義
const {
  mockListRecords,
  mockGetRecord,
  mockResolveHandle,
  mockGetProfiles,
  mockUploadBlob,
  mockCreateRecord,
  mockPutRecord,
  mockImageCompression
} = vi.hoisted(() => {
  return {
    mockPutRecord: vi.fn(),
    mockListRecords: vi.fn(),
    mockGetRecord: vi.fn(),
    mockResolveHandle: vi.fn(),
    mockGetProfiles: vi.fn(),
    mockUploadBlob: vi.fn(),
    mockCreateRecord: vi.fn(),
    mockImageCompression: vi.fn()
  };
});

// browser-image-compression のモック
vi.mock('browser-image-compression', () => {
  return {
    default: mockImageCompression
  };
});

// @atproto/api のモック
vi.mock('@atproto/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    // コンストラクタとして動作するように function で定義
    Agent: vi.fn(function () {
      return {
        api: {
          com: {
            atproto: {
              repo: {
                listRecords: mockListRecords,
                getRecord: mockGetRecord,
                createRecord: mockCreateRecord,
              }
            }
          }
        },
        resolveHandle: mockResolveHandle,
        uploadBlob: mockUploadBlob,
        app: {
          bsky: {
            actor: {
              getProfiles: mockGetProfiles
            }
          }
        }
      };
    }),
  };
});

// svelte/store のモック
vi.mock('svelte/store', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    get: vi.fn((store) => {
      if (store && store._id === 't') {
        return (key: string) => {
          if (key === 'share.template') return 'Diary Entry:';
          return key;
        };
      }
      if (store && store._id === 'locale') {
        return 'en';
      }

      // Default to session behavior (or specific check for session)
      return {
        did: 'did:self',
        agent: {
          api: {
            com: {
              atproto: {
                repo: {
                  listRecords: mockListRecords,
                  getRecord: mockGetRecord,
                  createRecord: mockCreateRecord,
                  putRecord: mockPutRecord, // Needed for createDiary update
                  deleteRecord: vi.fn()
                }
              }
            }
          },
          resolveHandle: mockResolveHandle,
          uploadBlob: mockUploadBlob,
          app: {
            bsky: {
              actor: {
                getProfiles: mockGetProfiles
              },
              graph: {
                getFollows: vi.fn().mockResolvedValue({ data: { follows: [] } })
              }
            }
          }
        }
      };
    })
  };
});

// $lib/auth/session のモック
vi.mock('$lib/auth/session', () => ({
  session: { _id: 'session' }
}));

// $lib/i18n のモック
vi.mock('$lib/i18n', () => ({
  t: { _id: 't' },
  locale: { _id: 'locale' }
}));

import { getEntries, getGlobalFeed, getAllEntriesForRanking, getPostInteractionState, getPds, uploadImage, createDiary, parseHubCursor, getEntryLikes } from '$lib/bsky';

globalThis.fetch = vi.fn();

// createDiary の共有指定。Nagi へのクロスポストは廃止した（Nagi は日記レコードを直接表示する）。
const shareOpt = (bluesky: boolean): any => ({ bluesky });
const NEW_ENTRY = 'com.suibari.trilinesat.diary';
const LEGACY_ENTRY = 'blue.trilinesat.diary';

// Node には Image が無いので、読み込み完了を即座に通知するスタブを用意する
function stubImage(width: number, height: number) {
  vi.stubGlobal('Image', class {
    naturalWidth = width;
    naturalHeight = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) { this.onload?.(); }
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
}

describe('bsky utils', () => {

  beforeEach(() => {
    vi.resetAllMocks();
    mockImageCompression.mockImplementation(async (file) => file); // デフォルトではそのまま返す(圧縮なしシミュレーション)
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getPds', () => {
    it('did:plcのPDSを解決できること', async () => {
      const mockDid = 'did:plc:123';
      const mockPds = 'https://pds.example.com';

      (globalThis.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: mockPds }]
        })
      });

      const result = await getPds(mockDid);
      expect(result).toBe(mockPds);
      expect(globalThis.fetch).toHaveBeenCalledWith(`https://plc.directory/${mockDid}`);
    });
  });

  describe('getEntries', () => {
    it('ページネーションを処理して全レコードを取得できること', async () => {
      mockListRecords.mockImplementation(async ({ collection, cursor }: any) => {
        if (collection === NEW_ENTRY)
          return cursor
            ? { data: { cursor: undefined, records: [{ uri: 'uri2', cid: 'cid2', value: { text: 'entry2', createdAt: '2026-11-02T00:00:00Z' } }] } }
            : { data: { cursor: 'cursor-1', records: [{ uri: 'uri1', cid: 'cid1', value: { text: 'entry1', createdAt: '2026-11-03T00:00:00Z' } }] } };
        return { data: { cursor: undefined, records: [] } };
      });

      const entries = await getEntries('did:self');

      // 新NSIDを2ページ、旧NSIDを1ページ読む
      expect(mockListRecords).toHaveBeenCalledTimes(3);
      expect(entries).toHaveLength(2);
    });

    it('新旧両方のNSIDの日記を作成日時の新しい順にまとめること', async () => {
      mockListRecords.mockImplementation(async ({ collection }: any) => ({
        data: {
          records: collection === NEW_ENTRY
            ? [{ uri: `at://did:self/${NEW_ENTRY}/n1`, cid: 'c', value: { createdAt: '2026-11-03T00:00:00Z' } }]
            : [
                { uri: `at://did:self/${LEGACY_ENTRY}/o1`, cid: 'c', value: { createdAt: '2026-11-04T00:00:00Z' } },
                { uri: `at://did:self/${LEGACY_ENTRY}/o2`, cid: 'c', value: { createdAt: '2026-10-01T00:00:00Z' } },
              ],
        },
      }));

      const entries = await getEntries('did:self');
      expect(entries.map((e: any) => e.uri.split('/').pop())).toEqual(['o1', 'n1', 'o2']);
    });
  });

  describe('getGlobalFeed', () => {
    it('Constellationからフィードを取得し、レコードを解決できること', async () => {
      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        if (url.includes('constellation') && url.includes(encodeURIComponent(NEW_ENTRY))) {
          return { ok: true, json: async () => [] };
        }
        if (url.includes('constellation')) {
          return {
            ok: true,
            json: async () => ([
              {
                did: 'did:plc:author1',
                rkey: 'rkey1',
                value: { text: 'Available in Constellation' },
                createdAt: '2024-01-01T10:00:00Z'
              },
              {
                did: 'did:plc:author2',
                rkey: 'rkey2',
                createdAt: '2024-01-01T09:00:00Z'
              }
            ])
          };
        } else if (url.includes('plc.directory')) {
          return {
            ok: true,
            json: async () => ({
              service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.author2.com' }]
            })
          };
        }
        return { ok: false, statusText: 'Not Found' };
      });

      mockGetRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:author2/col/rkey2',
          cid: 'cid2',
          value: { text: 'Fetched from PDS', createdAt: '2024-01-01T09:00:00Z' }
        }
      });

      const { posts } = await getGlobalFeed();

      expect(posts).toHaveLength(2);
      expect(posts[0].text).toBe('Available in Constellation');
      expect(posts[1].text).toBe('Fetched from PDS');
      // 旧NSIDのリンクは旧NSIDで PDS から引く
      expect(mockGetRecord).toHaveBeenCalledWith(expect.objectContaining({ collection: LEGACY_ENTRY }));
    });

    it('新旧のコレクションを別々に引き、カーソルをまとめて返すこと', async () => {
      const requested: string[] = [];
      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const parsed = new URL(url);
        requested.push(`${parsed.searchParams.get('collection')}:${parsed.searchParams.get('cursor') ?? ''}`);
        const collection = parsed.searchParams.get('collection');
        return {
          ok: true,
          json: async () => ({
            cursor: collection === NEW_ENTRY ? 'n-next' : undefined,
            linking_records: [],
          }),
        };
      });

      const first = await getGlobalFeed();
      expect(requested.sort()).toEqual([`${LEGACY_ENTRY}:`, `${NEW_ENTRY}:`]);
      expect(parseHubCursor(first.cursor)).toEqual({ [NEW_ENTRY]: 'n-next', [LEGACY_ENTRY]: null });

      requested.length = 0;
      const second = await getGlobalFeed(first.cursor);
      // 終わった旧NSIDはもう引かない
      expect(requested).toEqual([`${NEW_ENTRY}:n-next`]);
      expect(second.cursor).toBe(JSON.stringify({ [NEW_ENTRY]: 'n-next', [LEGACY_ENTRY]: null }));
    });

    it('移行前の素のカーソルは旧NSIDの続きとして扱うこと', () => {
      expect(parseHubCursor('old-cursor')).toEqual({ [NEW_ENTRY]: null, [LEGACY_ENTRY]: 'old-cursor' });
      expect(parseHubCursor(undefined)).toBeUndefined();
    });
  });

  describe('getAllEntriesForRanking', () => {
    it('ページネーションを行い、すべてのリンクを取得できること', async () => {
      let callCount = 0;
      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        if (url.includes('constellation') && url.includes(encodeURIComponent(NEW_ENTRY))) {
          return { ok: true, json: async () => ({ cursor: undefined, links: [{ did: 'did:3', rkey: 'rkey3' }] }) };
        }
        if (url.includes('constellation')) {
          callCount++;
          if (callCount === 1) {
            return {
              ok: true,
              json: async () => ({
                cursor: 'next-page',
                links: [{ did: 'did:1', rkey: 'rkey1' }]
              })
            };
          } else {
            return {
              ok: true,
              json: async () => ({
                cursor: undefined,
                links: [{ did: 'did:2', rkey: 'rkey2' }]
              })
            };
          }
        }
        return { ok: false };
      });

      const entries = await getAllEntriesForRanking();

      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.authorDid).sort()).toEqual(['did:1', 'did:2', 'did:3']);
      // リンクのコレクションから URI を組み立てる
      expect(entries.find((e) => e.authorDid === 'did:3')?.uri).toBe(`at://did:3/${NEW_ENTRY}/rkey3`);
      expect(entries.find((e) => e.authorDid === 'did:1')?.uri).toBe(`at://did:1/${LEGACY_ENTRY}/rkey1`);
    });
  });

  describe('getPostInteractionState', () => {
    it('いいね数と自分のいいね状態を取得できること', async () => {
      const entryUri = 'at://did:author/app/rkey';
      const viewerDid = 'did:self';

      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        return {
          ok: true,
          json: async () => ([
            { author: 'did:other' },
            { author: 'did:self', uri: 'at://did:self/like/1' }
          ])
        };
      });

      mockGetProfiles.mockResolvedValueOnce({
        data: {
          profiles: [
            { did: 'did:other', avatar: 'http://img/other.jpg' },
            { did: 'did:self', avatar: 'http://img/self.jpg' }
          ]
        }
      });

      const result = await getPostInteractionState({ uri: entryUri } as any, viewerDid);

      expect(result.likeCount).toBe(2);
      expect(result.viewerLike).toBe('at://did:self/like/1');
    });

    it('Bsky/Nagiの共有投稿へのいいねを合算し、同じDIDは1つとして数えること', async () => {
      const entry = {
        uri: 'at://did:author/blue.trilinesat.diary/rkey',
        sharedPost: { uri: 'at://did:author/app.bsky.feed.post/bsky', cid: 'c1' },
        sharedNagiPost: { uri: 'at://did:author/com.suibari.nagi.post/nagi', cid: 'c2' },
      };

      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const u = new URL(url);
        const collection = u.searchParams.get('collection');
        if (collection === 'blue.trilinesat.like') {
          return { ok: true, json: async () => ({ linking_records: [{ did: 'did:a', collection, rkey: 'l1' }] }) };
        }
        if (collection === 'app.bsky.feed.like') {
          return { ok: true, json: async () => ({ linking_dids: ['did:a', 'did:b', 'did:self'], cursor: null }) };
        }
        if (collection === 'com.suibari.nagi.reaction') {
          return { ok: true, json: async () => ({ linking_dids: ['did:b', 'did:c'], cursor: null }) };
        }
        return { ok: false, json: async () => ({}) };
      });

      const result = await getPostInteractionState(entry as any, 'did:self', true);

      expect(result.likeCount).toBe(4); // did:a, did:b, did:self, did:c
      expect(result.viewerLike).toBeUndefined();
      expect(result.viewerSharedLike).toBe(true);
      expect(result.candidateDids).toEqual(['did:a', 'did:b', 'did:self', 'did:c']);
    });

    it('新NSIDの日記では、TriLinesAtのスター・Blueskyのいいね・日記へのNagiリアクションを1人1回で合算すること', async () => {
      const entry = {
        uri: 'at://did:author/com.suibari.trilinesat.diary/rkey',
        sharedPost: { uri: 'at://did:author/app.bsky.feed.post/bsky', cid: 'c1' },
      };
      const reactionTargets: string[] = [];

      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const u = new URL(url);
        const collection = u.searchParams.get('collection');
        if (collection === 'com.suibari.trilinesat.like') {
          return { ok: true, json: async () => ({ linking_records: [{ did: 'did:star', collection, rkey: 'l1' }] }) };
        }
        if (collection === 'app.bsky.feed.like') {
          return { ok: true, json: async () => ({ linking_dids: ['did:bsky', 'did:star'], cursor: null }) };
        }
        if (collection === 'com.suibari.nagi.reaction') {
          reactionTargets.push(u.searchParams.get('target')!);
          return { ok: true, json: async () => ({ linking_dids: ['did:nagi', 'did:self'], cursor: null }) };
        }
        return { ok: true, json: async () => ({ linking_records: [] }) };
      });

      const result = await getPostInteractionState(entry as any, 'did:self', true);

      // 日記そのものを指す Nagi リアクションを数える（Nagi へのクロスポストは無い）。
      expect(reactionTargets).toEqual([entry.uri]);
      expect(result.likeCount).toBe(4); // did:star, did:bsky, did:nagi, did:self
      expect(result.viewerLike).toBeUndefined();
      expect(result.viewerSharedLike).toBe(true);
    });

    it('旧NSIDの日記では、日記URIへのNagiリアクションは引かないこと', async () => {
      const entry = { uri: 'at://did:author/blue.trilinesat.diary/rkey' };
      const reactionTargets: string[] = [];

      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const u = new URL(url);
        if (u.searchParams.get('collection') === 'com.suibari.nagi.reaction')
          reactionTargets.push(u.searchParams.get('target')!);
        return { ok: true, json: async () => ({ linking_records: [], linking_dids: [] }) };
      });

      await getPostInteractionState(entry as any, undefined, true);
      expect(reactionTargets).toEqual([]);
    });

    it('共有投稿へのいいね取得をページングして全件集めること', async () => {
      const entry = {
        uri: 'at://did:author/blue.trilinesat.diary/rkey',
        sharedPost: { uri: 'at://did:author/app.bsky.feed.post/bsky', cid: 'c1' },
      };

      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const u = new URL(url);
        if (u.searchParams.get('collection') !== 'app.bsky.feed.like') {
          return { ok: true, json: async () => ({ linking_records: [] }) };
        }
        return u.searchParams.get('cursor')
          ? { ok: true, json: async () => ({ linking_dids: ['did:y'], cursor: null }) }
          : { ok: true, json: async () => ({ linking_dids: ['did:x'], cursor: 'next' }) };
      });

      const result = await getPostInteractionState(entry as any, undefined, true);

      expect(result.likeCount).toBe(2);
    });

    it('TriLinesのいいね取得をページングし、value配下のDIDも数えること', async () => {
      const entry = { uri: 'at://did:author/blue.trilinesat.diary/rkey' };

      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const u = new URL(url);
        return u.searchParams.get('cursor')
          ? { ok: true, json: async () => ({ linking_records: [{ did: 'did:self', collection: 'blue.trilinesat.like', rkey: 'l2' }], cursor: null }) }
          : { ok: true, json: async () => ({ linking_records: [{ value: { did: 'did:nested' } }], cursor: 'next' }) };
      });

      const result = await getPostInteractionState(entry as any, 'did:self', true);

      expect(result.likeCount).toBe(2);
      expect(result.candidateDids).toEqual(['did:nested', 'did:self']);
      expect(result.viewerLike).toBe('at://did:self/blue.trilinesat.like/l2');
    });
  });

  describe('uploadImage', () => {
    it('1MB以下の画像はそのままアップロードされること', async () => {
      const smallBlob = new Blob(['a'.repeat(500)], { type: 'image/png' });
      mockUploadBlob.mockResolvedValue({ data: { blob: 'uploaded-blob' } });

      await uploadImage(smallBlob);

      expect(mockUploadBlob).toHaveBeenCalledWith(smallBlob, expect.anything());
      expect(mockImageCompression).not.toHaveBeenCalled();
    });

    it('1MB近い画像(950KB超)は圧縮されてアップロードされること', async () => {
      // 950KB + 1byte
      const largeBlob = new Blob(['a'.repeat(950001)], { type: 'image/png' });
      const compressedBlob = new Blob(['compressed'], { type: 'image/png' });

      mockImageCompression.mockResolvedValue(compressedBlob);
      mockUploadBlob.mockResolvedValue({ data: { blob: 'uploaded-blob' } });

      await uploadImage(largeBlob);

      expect(mockImageCompression).toHaveBeenCalled();
      expect(mockUploadBlob).toHaveBeenCalledWith(compressedBlob, expect.anything());
    });
  });

  describe('createDiary', () => {
    it('Blueskyに共有する場合、リンクファセット付きで投稿されること', async () => {
      mockCreateRecord.mockResolvedValue({
        data: { uri: 'at://did:self/app.bsky.feed.post/rkey123', cid: 'cid' }
      });
      mockUploadBlob.mockResolvedValue({ data: { blob: 'blob' } });

      const lines = [{ text: 'Diary entry' }];
      await createDiary(lines, shareOpt(true));

      // Verify the post creation call (second call)
      // First call is creating the TriLinesEntry, second is sharing to Bluesky
      expect(mockCreateRecord).toHaveBeenCalledTimes(2);

      const postCall = mockCreateRecord.mock.calls[1][0];
      expect(postCall.collection).toBe('app.bsky.feed.post');

      const record = postCall.record;
      // text should contain the link label
      expect(record.text).toContain('📓TriLinesAtで見る');
      // text should NOT contain the raw URL
      expect(record.text).not.toContain('https://trilinesat.suibari.com/entry/did:self/');

      // Check facets
      expect(record.facets).toBeDefined();
      const linkFacet = record.facets.find((f: any) =>
        f.features[0].$type === 'app.bsky.richtext.facet#link'
      );
      expect(linkFacet).toBeDefined();
      expect(linkFacet.features[0].uri).toMatch(/https:\/\/trilinesat\.suibari\.com\/entry\/did:self\/.*/);

      // Verify text slice matches the link label
      const encoder = new TextEncoder();
      const textBuffer = encoder.encode(record.text);
      const linkText = new TextDecoder().decode(
        textBuffer.slice(linkFacet.index.byteStart, linkFacet.index.byteEnd)
      );
      expect(linkText).toBe('📓TriLinesAtで見る');
    });

    it('共有なしの場合、日記レコードのみ作成されること', async () => {
      mockCreateRecord.mockResolvedValue({
        data: { uri: `at://did:self/${NEW_ENTRY}/rkey123`, cid: 'cid' }
      });

      const result = await createDiary([{ text: 'Diary entry' }], { bluesky: false });

      expect(mockCreateRecord).toHaveBeenCalledTimes(1);
      expect(mockPutRecord).not.toHaveBeenCalled();
      expect(result.shareErrors).toEqual([]);
    });

    it('Nagiへのクロスポストは作らないこと（Nagiは日記レコードを直接表示する）', async () => {
      mockCreateRecord.mockImplementation(async ({ collection }: any) => ({
        data: { uri: `at://did:self/${collection}/rkey123`, cid: 'cid' }
      }));

      await createDiary([{ text: 'Diary entry' }], { bluesky: true, nagi: true } as any);

      const collections = mockCreateRecord.mock.calls.map(([args]: any) => args.collection);
      expect(collections).toEqual([NEW_ENTRY, 'app.bsky.feed.post']);
    });

    it('日記への投稿参照の保存に失敗した場合、linkErrorが返ること', async () => {
      mockCreateRecord.mockImplementation(async ({ collection }: any) => ({
        data: { uri: `at://did:self/${collection}/rkey123`, cid: 'cid' }
      }));
      mockPutRecord.mockRejectedValueOnce(new Error('InvalidSwap'));

      const result = await createDiary([{ text: 'Diary entry' }], { bluesky: true });

      expect(mockPutRecord).toHaveBeenCalledTimes(1);
      expect(result.shareErrors).toEqual([]);
      expect(result.linkError).toBe(true);
    });
  });

  // 送信内容を固定する特性テスト。com.suibari.trilinesat.diary への移行で、日記レコードは
  // $type と langs を持ち、authorDid と空の image / sharedPost を書かなくなった。Bluesky 投稿は変更前と同じ。
  describe('互換性: createDiary の Bluesky 共有', () => {
    const NOW = '2025-01-02T03:04:05.000Z';
    const ENTRY_URI = `at://did:self/${NEW_ENTRY}/rkey123`;
    const HUB = 'at://did:plc:uixgxpiqf4i63p6rgpu7ytmx/app.bsky.actor.profile/self';
    const lines = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];

    beforeEach(() => {
      vi.setSystemTime(new Date(NOW));
      mockCreateRecord.mockImplementation(async ({ collection }: any) => (
        collection === NEW_ENTRY
          ? { data: { uri: ENTRY_URI, cid: 'entry-cid' } }
          : { data: { uri: `at://did:self/${collection}/post1`, cid: 'post-cid' } }
      ));
      mockUploadBlob.mockResolvedValue({ data: { blob: 'blob-ref' } });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('共有なしでは日記レコードだけを変更前と同じ内容で作成すること', async () => {
      await createDiary(lines, shareOpt(false));

      expect(mockCreateRecord).toHaveBeenCalledTimes(1);
      expect(mockCreateRecord.mock.calls[0][0]).toEqual({
        repo: 'did:self',
        collection: NEW_ENTRY,
        record: {
          $type: NEW_ENTRY,
          lines: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
          langs: ['en'],
          createdAt: NOW,
          hubRef: HUB,
        },
      });
      expect(mockPutRecord).not.toHaveBeenCalled();
    });

    it('Bluesky投稿・日記更新の引数が変更前と完全に一致すること', async () => {
      stubImage(800, 600);
      const image = new Blob(['x'], { type: 'image/png' });

      await createDiary([{ text: 'A', image }, { text: 'B' }, { text: 'C' }], shareOpt(true));

      expect(mockCreateRecord).toHaveBeenCalledTimes(2);

      // 1. 日記レコード
      const entryRecord = {
        $type: NEW_ENTRY,
        lines: [{ text: 'A', image: 'blob-ref' }, { text: 'B' }, { text: 'C' }],
        langs: ['en'],
        createdAt: NOW,
        hubRef: HUB,
      };
      expect(mockCreateRecord.mock.calls[0][0]).toEqual({
        repo: 'did:self',
        collection: NEW_ENTRY,
        record: entryRecord,
      });

      // 2. Bluesky 投稿
      const part1 = 'Diary Entry:\n\nA\nB\nC\n\n';
      const label = '📓TriLinesAtで見る';
      const part2 = `${part1}${label}\n\n`;
      const text = `${part2}#TriLinesAt`;
      const bytes = (str: string) => new TextEncoder().encode(str).byteLength;

      const postArgs = mockCreateRecord.mock.calls[1][0];
      expect(Object.keys(postArgs).sort()).toEqual(['collection', 'record', 'repo']);
      expect(postArgs).toEqual({
        repo: 'did:self',
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text,
          facets: [
            {
              index: { byteStart: bytes(part2), byteEnd: bytes(text) },
              features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'TriLinesAt' }],
            },
            {
              index: { byteStart: bytes(part1), byteEnd: bytes(part1 + label) },
              features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: 'https://trilinesat.suibari.com/entry/did:self/rkey123',
              }],
            },
          ],
          createdAt: NOW,
          langs: ['en'],
          embed: {
            $type: 'app.bsky.embed.images',
            images: [{ image: 'blob-ref', alt: 'A', aspectRatio: { width: 800, height: 600 } }],
          },
        },
      });

      // 3. 日記レコードへの sharedPost 書き戻し
      expect(mockPutRecord).toHaveBeenCalledTimes(1);
      expect(mockPutRecord.mock.calls[0][0]).toEqual({
        repo: 'did:self',
        collection: NEW_ENTRY,
        rkey: 'rkey123',
        record: { ...entryRecord, sharedPost: { uri: 'at://did:self/app.bsky.feed.post/post1', cid: 'post-cid' } },
        swapRecord: 'entry-cid',
      });
    });

    it('画像に alt があれば日記と Bluesky 投稿の両方に使うこと', async () => {
      stubImage(800, 600);
      const image = new Blob(['x'], { type: 'image/png' });

      await createDiary([{ text: 'A', image, alt: ' 猫の写真 ' }, { text: 'B' }, { text: 'C' }], shareOpt(true));

      expect(mockCreateRecord.mock.calls[0][0].record.lines[0]).toEqual({ text: 'A', image: 'blob-ref', alt: '猫の写真' });
      expect(mockCreateRecord.mock.calls[1][0].record.embed.images[0].alt).toBe('猫の写真');
    });

    it('画像なしならembedを付けず、長い本文は200文字で要約すること', async () => {
      const long = 'x'.repeat(50);
      await createDiary([{ text: long }, { text: long }, { text: long }, { text: long }, { text: long }], shareOpt(true));

      const record = mockCreateRecord.mock.calls[1][0].record;
      expect(record.embed).toBeUndefined();
      const summary = Array(5).fill(long).join('\n').substring(0, 200) + '...';
      expect(record.text).toBe(`Diary Entry:\n\n${summary}\n\n📓TriLinesAtで見る\n\n#TriLinesAt`);
    });

    it('Bluesky投稿に失敗しても例外を投げず、日記の更新もしないこと', async () => {
      mockCreateRecord.mockImplementation(async ({ collection }: any) => {
        if (collection === 'app.bsky.feed.post') throw new Error('boom');
        return { data: { uri: ENTRY_URI, cid: 'entry-cid' } };
      });

      await expect(createDiary(lines, shareOpt(true))).resolves.toBeDefined();
      expect(mockPutRecord).not.toHaveBeenCalled();
    });
  });

  describe('getEntryLikes', () => {
    it('新旧両方のスターを集め、それぞれのコレクションを付けること', async () => {
      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
        const collection = new URL(url).searchParams.get('collection');
        return {
          ok: true,
          json: async () => ({ linking_records: [{ did: collection === 'blue.trilinesat.like' ? 'did:old' : 'did:new', rkey: 'l' }] }),
        };
      });

      const links = await getEntryLikes('at://did:a/com.suibari.trilinesat.diary/r');
      expect(links).toEqual(
        expect.arrayContaining([
          { collection: 'com.suibari.trilinesat.like', did: 'did:new', rkey: 'l' },
          { collection: 'blue.trilinesat.like', did: 'did:old', rkey: 'l' },
        ]),
      );
    });
  });

  describe('getEntries の authorDid', () => {
    it('レコード本体のauthorDidではなくリポジトリのDIDを採用すること', async () => {
      mockListRecords.mockImplementation(async ({ collection }: any) => ({
        data: {
          records: collection === LEGACY_ENTRY
            ? [{ uri: `at://did:self/${LEGACY_ENTRY}/r1`, cid: 'c1', value: { authorDid: 'did:plc:someone-else' } }]
            : [],
        },
      }));

      const entries = await getEntries('did:self');
      expect(entries[0].authorDid).toBe('did:self');
    });
  });
});
