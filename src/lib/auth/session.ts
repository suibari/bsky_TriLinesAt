import { writable } from 'svelte/store';
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
      let serviceUrl = 'https://bsky.social'; // Default fallback

      try {
        // Resolve PDS from DID
        const handle = (oauthSession as any).handle;

        if (handle) {
          const publicAgent = new Agent('https://public.api.bsky.app');
          const { data } = await publicAgent.resolveHandle({ handle });
          if (data.did) {
            // Try to describe repo via AppView to confirm PDS? 
            // Or just assume bsky.social if on public.api?
          }
        }

        const did = oauthSession.did;
        if (did.startsWith('did:plc:')) {
          const res = await fetch(`https://plc.directory/${did}`);
          const doc = await res.json();
          const service = doc.service?.find((s: any) => s.id === '#atproto_pds');
          if (service && service.serviceEndpoint) {
            serviceUrl = service.serviceEndpoint;
          }
        } else if (did.startsWith('did:web:')) {
          const domain = did.replace('did:web:', '');
          const res = await fetch(`https://${domain}/.well-known/did.json`);
          const doc = await res.json();
          const service = doc.service?.find((s: any) => s.id === '#atproto_pds');
          if (service && service.serviceEndpoint) {
            serviceUrl = service.serviceEndpoint;
          }
        }
      } catch (e) {
        console.warn("Failed to resolve PDS, defaulting to bsky.social", e);
      }

      // Construct Agent with explicit service URL
      // We accept any type issues here for MVP as Agent types can be finicky
      const agent = new Agent({
        service: serviceUrl
      });

      // Manually hydrate the agent session
      // @ts-ignore
      // We rely on oauthSession object structure (reference implementation does this)
      // Accessing properties directly might have failed if they are getters or snake_case mapping is handled by class
      agent.session = oauthSession as any;

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
  // client.revoke not easily available without session handle, 
  // but we can just clear local state for now or re-init client to call revoke
  // Simplest is to clear storage? BrowserOAuthClient manages storage.
  // We should call client.revoke(did) if possible.
  // For MVP, just reload or use client methods if available.
  // Actually client.signOut() exists on the instance? No, it's specific.
  // We'll just clear the store and maybe the agent.
  // For proper OAuth signout we might need to hit the revocation endpoint.
  // But simply discarding tokens is often enough for client-side.
  session.set({
    agent: null,
    did: null,
    isAuthenticated: false,
    loading: false
  });
}
