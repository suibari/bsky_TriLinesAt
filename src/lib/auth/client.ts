import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { APP_URL, PREVIEW_URL, detectAppEnv, getAppOrigin } from '$lib/config';

// This function initializes the client. 
export async function createClient() {
  const appEnv = detectAppEnv();
  const isProd = appEnv === 'prod';
  const isPreview = appEnv === 'preview';
  const origin = getAppOrigin();

  const enc = encodeURIComponent;
  const scope = "atproto blob:*/* repo:blue.trilinesat.diary repo:blue.trilinesat.like repo:app.bsky.feed.post?action=create repo:com.suibari.nagi.post?action=create";
  const redirectUri = `${origin}/`; // We use root as redirect

  let client_id = "";
  if (isProd) {
    client_id = `${APP_URL}/client-metadata.json`;
  } else if (isPreview) {
    client_id = `${PREVIEW_URL}/client-metadata-preview.json`;
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
