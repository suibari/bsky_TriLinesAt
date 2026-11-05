import { writable, get } from 'svelte/store';
import { Agent } from '@atproto/api';
import { createClient } from './client';
import { hasCurrentWritePermissions } from './permissions';
import { t } from '$lib/i18n';

interface SessionState {
  agent: Agent | null;
  did: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export const session = writable<SessionState>({
  agent: null,
  did: null,
  isAuthenticated: false,
  loading: true,
});

const MOCK_DID_KEY = 'dev_mock_did';

// Dev only: act as `did` without OAuth so the signed-in UI can be checked locally.
// Enable with `?mockDid=did:plc:...` (kept for the tab via sessionStorage), disable with `?mockDid=`.
// The agent is unauthenticated, so reads work but writes (posting, likes) fail.
async function initMockSession(): Promise<boolean> {
  const param = new URLSearchParams(window.location.search).get('mockDid');
  if (param !== null) {
    if (param) sessionStorage.setItem(MOCK_DID_KEY, param);
    else sessionStorage.removeItem(MOCK_DID_KEY);
  }
  const did = sessionStorage.getItem(MOCK_DID_KEY);
  if (!did) return false;

  const { getPds } = await import('$lib/bsky');
  const agent = new Agent(await getPds(did));
  console.warn(`[dev] Mock session as ${did} (read-only)`);
  session.update(s => ({ ...s, agent, did, isAuthenticated: true, loading: false }));
  return true;
}

export async function initSession() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    try {
      if (await initMockSession()) return;
    } catch (e) {
      console.error('Mock session init error', e);
    }
  }

  try {
    const client = await createClient();
    const result = await client.init();

    if (result) {
      const { session: oauthSession } = result;
      const tokenInfo = await oauthSession.getTokenInfo();
      if (!hasCurrentWritePermissions(tokenInfo.scope)) {
        // Updating client metadata does not upgrade an existing authorization.
        // Reauthorize restored sessions, but never loop if a callback grants less access.
        if (!('state' in result)) {
          await client.signInRedirect(oauthSession.did, { state: 'scope-upgrade' });
          return;
        }
        await oauthSession.signOut();
        session.set({ agent: null, did: null, isAuthenticated: false, loading: false });
        alert(get(t)('auth.error_scope'));
        return;
      }

      // OAuthSession supplies the DID, PDS and DPoP-aware fetch handler to Agent.
      const agent = new Agent(oauthSession);

      session.update(s => ({
        ...s,
        agent,
        did: oauthSession.did,
        isAuthenticated: true,
        loading: false
      }));
    } else {
      session.update(s => ({ ...s, loading: false }));
    }
  } catch (e) {
    console.error('Session init error', e);
    session.update(s => ({ ...s, loading: false }));
  }
}

export async function signIn(handle: string) {
  const client = await createClient();
  // This will redirect
  await client.signIn(handle, {
    state: 'state', // optional
  });
}

export async function signOut() {
  const current = get(session);
  if (current.did) {
    try {
      const client = await createClient();
      await client.revoke(current.did);
    } catch (e) {
      console.warn("Revoke failed", e);
    }
  }

  session.set({
    agent: null,
    did: null,
    isAuthenticated: false,
    loading: false
  });
}
