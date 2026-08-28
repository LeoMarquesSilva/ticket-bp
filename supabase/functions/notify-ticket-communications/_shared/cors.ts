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

export function createCorsHeaders(appBaseUrl: string | undefined): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': appOrigin(appBaseUrl),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-instance',
    Vary: 'Origin',
  };
}
