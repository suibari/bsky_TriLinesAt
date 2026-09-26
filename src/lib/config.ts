// Public configuration. Values can be overridden with PUBLIC_* env vars (see .env.example).
// Defaults keep the production behavior, so builds work without any .env file.

export const APP_URL: string = import.meta.env.PUBLIC_APP_URL || 'https://trilinesat.suibari.com';
export const PREVIEW_URL: string = import.meta.env.PUBLIC_PREVIEW_URL || 'https://develop.bsky-trilinesat.pages.dev';
export const LOCAL_URL = 'http://127.0.0.1:5173';
export const NAGI_URL: string = import.meta.env.PUBLIC_NAGI_URL || 'https://nagi.suibari.com';

export type AppEnv = 'prod' | 'preview' | 'local';

export function detectAppEnv(): AppEnv {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  if (hostname === new URL(PREVIEW_URL).hostname) return 'preview';
  return 'prod';
}

// Origin of the running app (used for OAuth metadata and share links)
export function getAppOrigin(): string {
  const env = detectAppEnv();
  if (env === 'preview') return PREVIEW_URL;
  if (env === 'local') return LOCAL_URL;
  return APP_URL;
}
