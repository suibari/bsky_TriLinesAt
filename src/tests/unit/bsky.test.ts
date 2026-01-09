import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// vi.hoistedを使ってモック関数を定義し、vi.mock内での参照を確実にする
const {
  mockListRecords,
  mockGetRecord,
  mockResolveHandle,
  mockGetProfiles,
  mockUploadBlob,
  mockCreateRecord
} = vi.hoisted(() => {
  return {
    mockListRecords: vi.fn(),
    mockGetRecord: vi.fn(),
    mockResolveHandle: vi.fn(),
    mockGetProfiles: vi.fn(),
    mockUploadBlob: vi.fn(),
    mockCreateRecord: vi.fn()
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
    get: vi.fn(() => ({
      did: 'did:self',
      agent: {
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
      }
    }))
  };
});

// $lib/auth/session のモック
vi.mock('$lib/auth/session', () => ({
  session: {}
}));

import { getEntries, getGlobalFeed, getAllEntriesForRanking, getPostInteractionState, getPds } from '$lib/bsky';

global.fetch = vi.fn();

describe('bsky utils', () => {

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getPds', () => {
    it('did:plcのPDSを解決できること', async () => {
      const mockDid = 'did:plc:123';
      const mockPds = 'https://pds.example.com';

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: mockPds }]
        })
      });

      const result = await getPds(mockDid);
      expect(result).toBe(mockPds);
      expect(global.fetch).toHaveBeenCalledWith(`https://plc.directory/${mockDid}`);
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
      (global.fetch as Mock).mockImplementation(async (url: string) => {
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
      (global.fetch as Mock).mockImplementation(async (url: string) => {
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

      (global.fetch as Mock).mockImplementation(async (url: string) => {
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
});
