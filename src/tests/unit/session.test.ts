import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { hasCurrentWritePermissions, isPermissionError } from '$lib/auth/permissions';

const mocks = vi.hoisted(() => ({
  init: vi.fn(), redirect: vi.fn(), signOut: vi.fn(), agent: vi.fn(function () {})
}));
vi.mock('$lib/auth/client', () => ({ createClient: async () => ({
  init: mocks.init, signInRedirect: mocks.redirect
}) }));
vi.mock('@atproto/api', () => ({ Agent: mocks.agent }));
import { initSession, session } from '$lib/auth/session';

const current = 'atproto repo:com.suibari.trilinesat.diary repo:com.suibari.trilinesat.like';
const legacy = 'atproto repo:blue.trilinesat.diary repo:blue.trilinesat.like';

beforeEach(() => {
  vi.clearAllMocks();
  session.set({ agent: null, did: null, isAuthenticated: false, loading: true });
});

function oauthSession(scope: string) {
  return { did: 'did:plc:test', getTokenInfo: async () => ({ scope }), signOut: mocks.signOut };
}

describe('OAuth scope migration', () => {
  it('reauthorizes a restored legacy session before allowing writes', async () => {
    mocks.init.mockResolvedValue({ session: oauthSession(legacy) });
    await initSession();
    expect(mocks.redirect).toHaveBeenCalledWith('did:plc:test', { state: 'scope-upgrade' });
    expect(get(session).isAuthenticated).toBe(false);
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it('does not redirect repeatedly if the callback lacks permissions', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    mocks.init.mockResolvedValue({ session: oauthSession(legacy), state: 'scope-upgrade' });
    await initSession();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalled();
    expect(get(session).loading).toBe(false);
    expect(alert).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('passes the OAuth session directly to Agent for an authorized session', async () => {
    const oauth = oauthSession(current);
    mocks.init.mockResolvedValue({ session: oauth });
    await initSession();
    expect(mocks.agent).toHaveBeenCalledWith(oauth);
    expect(get(session).isAuthenticated).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([current, 'atproto transition:generic', 'atproto repo:*'])(
    'accepts existing sufficient grants: %s', scope => {
      expect(hasCurrentWritePermissions(scope)).toBe(true);
    }
  );

  it.each([legacy, 'atproto repo:com.suibari.trilinesat.diary',
    'atproto repo:com.suibari.trilinesat.diary repo:com.suibari.trilinesat.like?action=create'])(
    'rejects incomplete write grants: %s', scope => {
      expect(hasCurrentWritePermissions(scope)).toBe(false);
    }
  );

  it('distinguishes permission failures from network and indexing failures', () => {
    expect(isPermissionError({ status: 403 })).toBe(true);
    expect(isPermissionError({ error: 'InvalidScope' })).toBe(true);
    expect(isPermissionError({ status: 500 })).toBe(false);
    expect(isPermissionError(new Error('Network failure'))).toBe(false);
  });
});
