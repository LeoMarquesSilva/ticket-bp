const FALLBACK_ORIGIN = 'https://configuration.invalid';

function appOrigin(appBaseUrl: string | undefined): string {
  try {
    const url = new URL(appBaseUrl ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password) return url.origin;
  } catch {
    // A origem reservada falha fechada até APP_PUBLIC_URL ser configurada.
  }
  return FALLBACK_ORIGIN;
}

function isLocalDevOrigin(origin: string | null | undefined): origin is string {
  if (typeof origin !== 'string' || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function createCorsHeaders(
  appBaseUrl: string | undefined,
  requestOrigin?: string | null,
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isLocalDevOrigin(requestOrigin)
      ? requestOrigin
      : appOrigin(appBaseUrl),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-instance',
    Vary: 'Origin',
  };
}
