import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

// This function initializes the client. 
export async function createClient() {
  // 1. Determine environment
  // In Vite, import.meta.env.DEV is true for dev.
  // Or we can check window.location.hostname

  // Hardcoded production URL for now as per user request
  const publicUrl = "https://trilinesat.suibari.com";
  const previewUrl = "https://develop.bsky-trilinesat.pages.dev";
  const localUrl = "http://127.0.0.1:5173";

  const hostname = typeof window !== 'undefined' ? window.location.hostname : "";
  const isPreview = hostname === "develop.bsky-trilinesat.pages.dev";
  const isProd = hostname !== "localhost" && hostname !== "127.0.0.1" && !isPreview;

  let origin = localUrl;
  if (isProd) {
    origin = publicUrl;
  } else if (isPreview) {
    origin = previewUrl;
  }

  const enc = encodeURIComponent;
  const scope = "atproto blob:*/* repo:blue.trilinesat.diary repo:blue.trilinesat.like repo:app.bsky.feed.post?action=create";
  const redirectUri = `${origin}/`; // We use root as redirect

  let client_id = "";
  if (isProd) {
    client_id = `${publicUrl}/client-metadata.json`;
  } else if (isPreview) {
    client_id = `${previewUrl}/client-metadata-preview.json`;
  } else {
    // Special loopback client ID format for local dev
    // Note: redirect_uri must match exactly what is in redirect_uris
    client_id = `http://localhost?redirect_uri=${enc(redirectUri)}&scope=${enc(scope)}`;
  }

  return new BrowserOAuthClient({
    handleResolver: 'https://bsky.social',
    clientMetadata: {
      client_id,
      client_name: isPreview ? 'TriLinesAt (Preview)' : 'TriLinesAt',
      client_uri: origin,
      logo_uri: `${origin}/favicon.png`,
      tos_uri: `${origin}/tos`,
      policy_uri: `${origin}/policy`,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope,
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: isProd || isPreview,
    },
  });
}
