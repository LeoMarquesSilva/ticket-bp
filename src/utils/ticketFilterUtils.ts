export type CategoriesConfigMap = Record<
  string,
  { label: string; tagId?: string; subcategories: { value: string; label: string; slaHours: number }[] }
>;

export function getCategoryKeysForFrente(
  categoriesConfig: CategoriesConfigMap,
  frenteId: string
): string[] {
  if (frenteId === 'sem-frente') {
    return Object.entries(categoriesConfig)
      .filter(([, c]) => !c.tagId)
      .map(([k]) => k);
  }
  return Object.entries(categoriesConfig)
    .filter(([, c]) => c.tagId === frenteId)
    .map(([k]) => k);
}

export function ticketMatchesFrente(
  ticketCategory: string,
  frenteFilter: string,
  categoriesConfig: CategoriesConfigMap
): boolean {
  if (frenteFilter === 'all') return true;
  const keys = getCategoryKeysForFrente(categoriesConfig, frenteFilter);
  return keys.includes(ticketCategory);
}
