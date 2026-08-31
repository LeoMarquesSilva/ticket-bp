const SETTINGS_TABS = new Set(['comunicacoes', 'quando-enviar', 'whatsapp']);

export function getInitialSettingsTab(search: string): string {
  const requested = new URLSearchParams(search).get('tab');
  return requested && SETTINGS_TABS.has(requested) ? requested : 'comunicacoes';
}

export function getSettingsRedirectFromCategorySearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab !== 'comunicacoes' && tab !== 'whatsapp') return null;
  return `/settings?${params.toString()}`;
}
