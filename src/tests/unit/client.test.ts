import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prodMetadata from '../../../static/client-metadata.json';
import previewMetadata from '../../../static/client-metadata-preview.json';

const { MockOAuthClient } = vi.hoisted(() => ({
  MockOAuthClient: vi.fn(function (this: any, opts: any) { this.opts = opts; })
}));

vi.mock('@atproto/oauth-client-browser', () => ({
  BrowserOAuthClient: MockOAuthClient
}));

import { createClient } from '$lib/auth/client';

const LEGACY_SCOPE = 'atproto blob:*/* repo:blue.trilinesat.diary repo:blue.trilinesat.like repo:app.bsky.feed.post?action=create';
const NAGI_SCOPE = 'repo:com.suibari.nagi.post?action=create';

async function metadataFor(hostname: string) {
  vi.stubGlobal('window', { location: { hostname } });
  await createClient();
  const opts = MockOAuthClient.mock.calls.at(-1)![0];
  return opts;
}

// scope 以外は変更前の実装と完全一致することを固定する（変更前コードでも通ることを確認済み）
function withoutScope(meta: any) {
  const { scope, client_id, ...rest } = meta;
  // ループバックの client_id は scope を含むので、scope 部分を除いて比較する
  return { ...rest, client_id: client_id.replace(/&scope=.*$/, '') };
}

describe('createClient', () => {
  beforeEach(() => {
    MockOAuthClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('互換性: OAuthクライアント設定', () => {
    it('本番ホストでは本番のclient-metadataを使うこと', async () => {
      const opts = await metadataFor('trilinesat.suibari.com');
      expect(opts.handleResolver).toBe('https://bsky.social');
      expect(withoutScope(opts.clientMetadata)).toEqual({
        client_id: 'https://trilinesat.suibari.com/client-metadata.json',
        client_name: 'TriLinesAt',
        client_uri: 'https://trilinesat.suibari.com',
        logo_uri: 'https://trilinesat.suibari.com/favicon.png',
        tos_uri: 'https://trilinesat.suibari.com/tos',
        policy_uri: 'https://trilinesat.suibari.com/policy',
        redirect_uris: ['https://trilinesat.suibari.com/'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        dpop_bound_access_tokens: true,
      });
    });

    it('プレビューホストではプレビュー用のclient-metadataを使うこと', async () => {
      const opts = await metadataFor('develop.bsky-trilinesat.pages.dev');
      expect(withoutScope(opts.clientMetadata)).toEqual({
        client_id: 'https://develop.bsky-trilinesat.pages.dev/client-metadata-preview.json',
        client_name: 'TriLinesAt (Preview)',
        client_uri: 'https://develop.bsky-trilinesat.pages.dev',
        logo_uri: 'https://develop.bsky-trilinesat.pages.dev/favicon.png',
        tos_uri: 'https://develop.bsky-trilinesat.pages.dev/tos',
        policy_uri: 'https://develop.bsky-trilinesat.pages.dev/policy',
        redirect_uris: ['https://develop.bsky-trilinesat.pages.dev/'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        dpop_bound_access_tokens: true,
      });
    });

    it.each(['localhost', '127.0.0.1'])('%s ではループバッククライアントを使うこと', async (host) => {
      const opts = await metadataFor(host);
      expect(withoutScope(opts.clientMetadata)).toEqual({
        client_id: `http://localhost?redirect_uri=${encodeURIComponent('http://127.0.0.1:5173/')}`,
        client_name: 'TriLinesAt',
        client_uri: 'http://127.0.0.1:5173',
        logo_uri: 'http://127.0.0.1:5173/favicon.png',
        tos_uri: 'http://127.0.0.1:5173/tos',
        policy_uri: 'http://127.0.0.1:5173/policy',
        redirect_uris: ['http://127.0.0.1:5173/'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        dpop_bound_access_tokens: false,
      });
    });

    it('既存のスコープをすべて保持していること', async () => {
      const opts = await metadataFor('trilinesat.suibari.com');
      expect(opts.clientMetadata.scope.startsWith(LEGACY_SCOPE)).toBe(true);
    });
  });

  it('Nagi投稿のスコープを要求すること', async () => {
    const opts = await metadataFor('trilinesat.suibari.com');
    expect(opts.clientMetadata.scope).toBe(`${LEGACY_SCOPE} ${NAGI_SCOPE}`);

    const local = await metadataFor('127.0.0.1');
    expect(local.clientMetadata.client_id).toContain(`&scope=${encodeURIComponent(`${LEGACY_SCOPE} ${NAGI_SCOPE}`)}`);
  });

  it.each([
    ['trilinesat.suibari.com', prodMetadata],
    ['develop.bsky-trilinesat.pages.dev', previewMetadata],
  ])('%s の設定が static の client-metadata と一致すること', async (host, staticMeta) => {
    const opts = await metadataFor(host);
    expect(opts.clientMetadata).toEqual(staticMeta);
  });
});
