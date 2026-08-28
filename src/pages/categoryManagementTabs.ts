const CATEGORY_MANAGEMENT_TABS = new Set([
  'categorias',
  'frentes',
  'whatsapp',
  'respostas-rapidas',
  'comunicacoes',
]);

export function getInitialCategoryManagementTab(search: string): string {
  const requested = new URLSearchParams(search).get('tab');
  return requested && CATEGORY_MANAGEMENT_TABS.has(requested) ? requested : 'categorias';
}
