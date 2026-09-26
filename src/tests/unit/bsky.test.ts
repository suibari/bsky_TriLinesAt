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

import { getEntries, getGlobalFeed, getAllEntriesForRanking, getPostInteractionState, getPds, uploadImage, createDiary } from '$lib/bsky';

globalThis.fetch = vi.fn();

// createDiary の共有指定。互換性テストを変更前のコード（第2引数が boolean）でも実行できるよう、ここに集約する。
const shareOpt = (bluesky: boolean): any => ({ bluesky, nagi: false });

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
      mockListRecords.mockResolvedValueOnce({
        data: {
          cursor: 'cursor-1',
          records: [
            { uri: 'uri1', cid: 'cid1', value: { text: 'entry1' } }
          ]
        }
      });
      mockListRecords.mockResolvedValueOnce({
        data: {
          cursor: undefined,
          records: [
            { uri: 'uri2', cid: 'cid2', value: { text: 'entry2' } }
          ]
        }
      });

      const entries = await getEntries('did:self');

      expect(mockListRecords).toHaveBeenCalledTimes(2);
      expect(entries).toHaveLength(2);
    });
  });

  describe('getGlobalFeed', () => {
    it('Constellationからフィードを取得し、レコードを解決できること', async () => {
      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
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
    });
  });

  describe('getAllEntriesForRanking', () => {
    it('ページネーションを行い、すべてのリンクを取得できること', async () => {
      let callCount = 0;
      (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
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

      expect(entries).toHaveLength(2);
      expect(entries[0].authorDid).toBe('did:1');
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
        data: { uri: 'at://did:self/blue.trilinesat.diary/rkey123', cid: 'cid' }
      });

      const result = await createDiary([{ text: 'Diary entry' }], { bluesky: false, nagi: false });

      expect(mockCreateRecord).toHaveBeenCalledTimes(1);
      expect(mockPutRecord).not.toHaveBeenCalled();
      expect(result.shareErrors).toEqual([]);
    });

    it('Nagiに共有する場合、com.suibari.nagi.postとして画像付きで投稿されること', async () => {
      mockCreateRecord.mockImplementation(async ({ collection }: any) => ({
        data: { uri: `at://did:self/${collection}/rkey123`, cid: `cid-${collection}` }
      }));
      mockUploadBlob.mockResolvedValue({ data: { blob: 'blob' } });

      stubImage(0, 0);
      const image = new Blob(['x'], { type: 'image/png' });
      const result = await createDiary([{ text: 'Diary entry', image }], { bluesky: false, nagi: true });

      expect(mockCreateRecord).toHaveBeenCalledTimes(2);
      const nagiCall = mockCreateRecord.mock.calls[1][0];
      expect(nagiCall.collection).toBe('com.suibari.nagi.post');
      expect(nagiCall.validate).toBe(false);
      expect(nagiCall.record.$type).toBe('com.suibari.nagi.post');
      expect(nagiCall.record.embed.$type).toBe('com.suibari.nagi.post#images');
      expect(nagiCall.record.embed.images[0].image).toBe('blob');
      expect(nagiCall.record.facets.some((f: any) =>
        f.features[0].$type === 'app.bsky.richtext.facet#link'
      )).toBe(true);

      const putCall = mockPutRecord.mock.calls[0][0];
      expect(putCall.record.sharedNagiPost).toEqual({
        uri: 'at://did:self/com.suibari.nagi.post/rkey123',
        cid: 'cid-com.suibari.nagi.post'
      });
      expect(putCall.record.sharedPost).toBeUndefined();
      expect(result.shareErrors).toEqual([]);
      vi.unstubAllGlobals();
    });

    it('片方の共有が失敗しても、もう片方は保存されエラーが返ること', async () => {
      mockCreateRecord.mockImplementation(async ({ collection }: any) => {
        if (collection === 'com.suibari.nagi.post') throw new Error('ScopeMissing');
        return { data: { uri: `at://did:self/${collection}/rkey123`, cid: 'cid' } };
      });

      const result = await createDiary([{ text: 'Diary entry' }], { bluesky: true, nagi: true });

      expect(mockCreateRecord).toHaveBeenCalledTimes(3);
      const putCall = mockPutRecord.mock.calls[0][0];
      expect(putCall.record.sharedPost.uri).toBe('at://did:self/app.bsky.feed.post/rkey123');
      expect(putCall.record.sharedNagiPost).toBeUndefined();
      expect(result.shareErrors).toEqual(['nagi']);
    });
  });

  // 変更前の実装と送信内容が完全一致することを固定する特性テスト。
  // 変更前コードでも同じテストが通ることを確認済み（shareOpt で引数形式だけ吸収）。
  describe('互換性: createDiary の Bluesky 共有', () => {
    const NOW = '2025-01-02T03:04:05.000Z';
    const ENTRY_URI = 'at://did:self/blue.trilinesat.diary/rkey123';
    const HUB = 'at://did:plc:uixgxpiqf4i63p6rgpu7ytmx/app.bsky.actor.profile/self';
    const lines = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];

    beforeEach(() => {
      vi.setSystemTime(new Date(NOW));
      mockCreateRecord.mockImplementation(async ({ collection }: any) => (
        collection === 'blue.trilinesat.diary'
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
        collection: 'blue.trilinesat.diary',
        record: {
          lines: [
            { text: 'A', image: undefined },
            { text: 'B', image: undefined },
            { text: 'C', image: undefined },
          ],
          createdAt: NOW,
          sharedPost: undefined,
          authorDid: 'did:self',
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
        lines: [
          { text: 'A', image: 'blob-ref' },
          { text: 'B', image: undefined },
          { text: 'C', image: undefined },
        ],
        createdAt: NOW,
        sharedPost: undefined,
        authorDid: 'did:self',
        hubRef: HUB,
      };
      expect(mockCreateRecord.mock.calls[0][0]).toEqual({
        repo: 'did:self',
        collection: 'blue.trilinesat.diary',
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
        collection: 'blue.trilinesat.diary',
        rkey: 'rkey123',
        record: { ...entryRecord, sharedPost: { uri: 'at://did:self/app.bsky.feed.post/post1', cid: 'post-cid' } },
        swapRecord: 'entry-cid',
      });
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

  describe('getEntries の authorDid', () => {
    it('レコード本体のauthorDidではなくリポジトリのDIDを採用すること', async () => {
      mockListRecords.mockResolvedValueOnce({
        data: { records: [{ uri: 'at://did:self/blue.trilinesat.diary/r1', cid: 'c1', value: { authorDid: 'did:plc:someone-else' } }] }
      });

      const entries = await getEntries('did:self');
      expect(entries[0].authorDid).toBe('did:self');
    });
  });
});
