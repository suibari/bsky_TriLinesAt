import { writable, get } from 'svelte/store';
import { Agent } from '@atproto/api';
import { createClient } from './client';

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

export async function initSession() {
  try {
    const client = await createClient();
    const result = await client.init();

    if (result) {
      const { session: oauthSession } = result;
      // Provide the fetch handler from the client if possible, or rely on the session data
      // Since OAuthSession might not be exactly AtpSessionData, we might strictly only need the DID and headers
      // Manually hydrate the agent session immediately to get the token and PDS URL
      let accessToken = undefined;
      let refreshToken = undefined;
      let serviceUrl = undefined; // Initialize to undefined

      try {
        // getTokenSet is protected but available at runtime. 
        const tokenSet = await (oauthSession as any).getTokenSet();
        if (tokenSet) {
          accessToken = tokenSet.access_token;
          refreshToken = tokenSet.refresh_token;

          // Optimization: Extract PDS (aud) from access token
          // This avoids the network call to PLC directory and ensures we use the exact PDS the token is for.
          if ((tokenSet as any).aud) {
            serviceUrl = (tokenSet as any).aud;
            // console.log('Using PDS from tokenSet.aud:', serviceUrl);
          }
        }
      } catch (e) {
        // Silent catch or minimal warn if needed
      }

      // Final Check: If we didn't get serviceUrl from token, we cannot proceed safely.
      // Defaulting to bsky.social is dangerous for other PDS users (auth errors).
      if (!serviceUrl) {
        console.error("Failed to resolve PDS from token 'aud'. Aborting session.");
        await signOut();
        return;
      }

      // Construct Agent with explicit service URL & OAuth fetch handler
      // This ensures requests are signed/handled correctly (DPoP etc) by the OAuth lib
      const agent = new Agent({
        service: serviceUrl,
        fetch: (url, init) => {
          return (oauthSession as any).fetchHandler(url, init);
        }
      });

      // @ts-ignore
      agent.session = {
        did: oauthSession.did,
        handle: (oauthSession as any).handle || '',
        accessJwt: accessToken || (oauthSession as any).access_token,
        refreshJwt: refreshToken || (oauthSession as any).refresh_token,
        email: (oauthSession as any).email,
        emailConfirmed: (oauthSession as any).emailConfirmed,
      };

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
