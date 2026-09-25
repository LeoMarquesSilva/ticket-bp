import type { CategoriesConfigMap } from './ticketFilterUtils';

export const UNCATEGORIZED_CATEGORY_KEY = '__uncategorized__';
export const NO_FRENTE_KEY = '__no_frente__';

export interface TicketFrenteDefinition {
  id: string;
  label: string;
  color?: string;
  icon?: string;
}

export type FrenteIconName =
  | 'briefcase'
  | 'building-2'
  | 'calculator'
  | 'clipboard-check'
  | 'database'
  | 'file-text'
  | 'flask-conical'
  | 'landmark'
  | 'megaphone'
  | 'monitor'
  | 'scale'
  | 'shield-check'
  | 'users';

export const FRENTE_ICON_OPTIONS: Array<{ value: FrenteIconName; label: string }> = [
  { value: 'briefcase', label: 'Negócios' },
  { value: 'users', label: 'Pessoas' },
  { value: 'building-2', label: 'Empresas' },
  { value: 'monitor', label: 'Tecnologia' },
  { value: 'scale', label: 'Jurídico' },
  { value: 'landmark', label: 'Tributário' },
  { value: 'calculator', label: 'Financeiro' },
  { value: 'clipboard-check', label: 'Controladoria' },
  { value: 'database', label: 'Dados' },
  { value: 'flask-conical', label: 'Laboratório' },
  { value: 'file-text', label: 'Documentos' },
  { value: 'megaphone', label: 'Marketing' },
  { value: 'shield-check', label: 'Compliance' },
];

const EXPLICIT_FRENTE_ICON_ALIASES: Record<string, FrenteIconName> = {
  briefcase: 'briefcase',
  maleta: 'briefcase',
  building: 'building-2',
  building2: 'building-2',
  empresa: 'building-2',
  calculator: 'calculator',
  calculadora: 'calculator',
  clipboardcheck: 'clipboard-check',
  controladoria: 'clipboard-check',
  database: 'database',
  dados: 'database',
  file: 'file-text',
  filetext: 'file-text',
  documento: 'file-text',
  flask: 'flask-conical',
  flaskconical: 'flask-conical',
  laboratorio: 'flask-conical',
  landmark: 'landmark',
  predio: 'landmark',
  marketing: 'megaphone',
  megaphone: 'megaphone',
  monitor: 'monitor',
  computador: 'monitor',
  scale: 'scale',
  balanca: 'scale',
  shield: 'shield-check',
  shieldcheck: 'shield-check',
  escudo: 'shield-check',
  users: 'users',
  pessoas: 'users',
};

const SEMANTIC_FRENTE_ICON_RULES: Array<{
  icon: FrenteIconName;
  terms: string[];
}> = [
  { icon: 'users', terms: ['trabalhista', 'recursos humanos', 'pessoas', 'rh'] },
  { icon: 'building-2', terms: ['societario', 'societaria', 'corporativo', 'empresarial', 'empresa'] },
  { icon: 'monitor', terms: ['tecnologia', 'sistemas', 'software', 'informatica', 'ti'] },
  { icon: 'scale', terms: ['juridico', 'juridica', 'legal', 'litigio', 'contencioso'] },
  { icon: 'landmark', terms: ['tributario', 'tributaria', 'fiscal', 'impostos'] },
  { icon: 'calculator', terms: ['financeiro', 'financeira', 'financas', 'contabil', 'contabilidade'] },
  { icon: 'clipboard-check', terms: ['controladoria', 'controller', 'controles internos'] },
  { icon: 'database', terms: ['dados', 'analytics', 'inteligencia', 'data'] },
  { icon: 'flask-conical', terms: ['laboratorio', 'inovacao', 'lab'] },
  { icon: 'file-text', terms: ['contratos', 'contrato', 'documentos', 'documental'] },
  { icon: 'megaphone', terms: ['marketing', 'comunicacao', 'mkt'] },
  { icon: 'shield-check', terms: ['compliance', 'riscos', 'risco', 'privacidade', 'lgpd', 'seguranca'] },
];

function normalizeFrenteIconValue(value?: string | null) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? '';
}

function includesSemanticTerm(value: string, term: string) {
  return ` ${value} `.includes(` ${term} `);
}

export function resolveFrenteIconName(
  icon?: string | null,
  key?: string | null,
  label?: string | null,
): FrenteIconName {
  const normalizedIcon = normalizeFrenteIconValue(icon).replace(/\s+/g, '');
  const explicitIcon = EXPLICIT_FRENTE_ICON_ALIASES[normalizedIcon];
  if (explicitIcon) return explicitIcon;

  const semanticValue = normalizeFrenteIconValue(`${key ?? ''} ${label ?? ''}`);
  const semanticRule = SEMANTIC_FRENTE_ICON_RULES.find((rule) =>
    rule.terms.some((term) => includesSemanticTerm(semanticValue, term)),
  );

  return semanticRule?.icon ?? 'briefcase';
}

export interface TicketCategoryGroup<T> {
  key: string;
  label: string;
  tickets: T[];
}

export interface TicketFrenteGroup<T> extends TicketFrenteDefinition {
  key: string;
  ticketCount: number;
  categories: TicketCategoryGroup<T>[];
}

export function shouldUseFrenteHierarchy(
  canViewAllTickets: boolean,
  userFrenteIds: readonly string[],
): boolean {
  return canViewAllTickets || new Set(userFrenteIds).size > 1;
}

export function getTicketListFilterExpansion(
  searchTerm: string,
  categoryFilter: string,
  frenteFilter: string,
) {
  const expandCategories = searchTerm.trim() !== '' || categoryFilter !== 'all';
  return {
    expandCategories,
    expandFrentes: expandCategories || frenteFilter !== 'all',
  };
}

export function toggleFrenteCategoryExpansion(
  expandedCategoryKeys: readonly string[],
  frenteCategoryKeys: readonly string[],
): string[] {
  const expanded = new Set(expandedCategoryKeys);
  const frenteKeys = new Set(frenteCategoryKeys);
  if (frenteCategoryKeys.every((key) => expanded.has(key))) {
    return expandedCategoryKeys.filter((key) => !frenteKeys.has(key));
  }
  return [...new Set([...expandedCategoryKeys, ...frenteCategoryKeys])];
}

export function getTicketCategoryColumnCount(width: number, isChatOpen: boolean): 1 | 2 | 3 {
  if (isChatOpen || width < 576) return 1;
  return width < 992 ? 2 : 3;
}

export function groupTicketCategoryRows<T>(categories: readonly T[], columns: 1 | 2 | 3): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < categories.length; index += columns) {
    rows.push(categories.slice(index, index + columns));
  }
  return rows;
}

export function expandVisibleTicketCategories<T extends { category?: string | null }>(
  expandedCategoryKeys: readonly string[],
  visibleTickets: readonly T[],
): string[] {
  const visibleCategoryKeys = visibleTickets.map(
    (ticket) => ticket.category?.trim() || UNCATEGORIZED_CATEGORY_KEY,
  );
  return [...new Set([...expandedCategoryKeys, ...visibleCategoryKeys])];
}

export function expandVisibleTicketFrentes<T extends { category?: string | null }>(
  expandedFrenteKeys: readonly string[],
  visibleTickets: readonly T[],
  categoriesConfig: CategoriesConfigMap,
): string[] {
  const visibleFrenteKeys = visibleTickets.map((ticket) => {
    const categoryKey = ticket.category?.trim() || UNCATEGORIZED_CATEGORY_KEY;
    return categoriesConfig[categoryKey]?.tagId || NO_FRENTE_KEY;
  });
  return [...new Set([...expandedFrenteKeys, ...visibleFrenteKeys])];
}

function getFallbackCategoryLabel(key: string) {
  if (key === UNCATEGORIZED_CATEGORY_KEY) return 'Sem categoria';

  const normalized = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Sem categoria';
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}

export function groupTicketsByCategory<T extends { category?: string | null }>(
  tickets: readonly T[],
  categoriesConfig: CategoriesConfigMap,
): TicketCategoryGroup<T>[] {
  const ticketsByCategory = new Map<string, T[]>();

  tickets.forEach((ticket) => {
    const key = ticket.category?.trim() || UNCATEGORIZED_CATEGORY_KEY;
    const current = ticketsByCategory.get(key);
    if (current) current.push(ticket);
    else ticketsByCategory.set(key, [ticket]);
  });

  const configuredKeys = Object.keys(categoriesConfig).filter((key) => ticketsByCategory.has(key));
  const configuredKeySet = new Set(configuredKeys);
  const remainingKeys = [...ticketsByCategory.keys()].filter((key) => !configuredKeySet.has(key));

  return [...configuredKeys, ...remainingKeys].map((key) => ({
    key,
    label: categoriesConfig[key]?.label?.trim() || getFallbackCategoryLabel(key),
    tickets: ticketsByCategory.get(key) ?? [],
  }));
}

export function groupTicketsByFrente<T extends { category?: string | null }>(
  tickets: readonly T[],
  categoriesConfig: CategoriesConfigMap,
  frentes: readonly TicketFrenteDefinition[],
): TicketFrenteGroup<T>[] {
  const categoryGroups = groupTicketsByCategory(tickets, categoriesConfig);
  const categoriesByFrente = new Map<string, TicketCategoryGroup<T>[]>();

  categoryGroups.forEach((category) => {
    const frenteKey = categoriesConfig[category.key]?.tagId || NO_FRENTE_KEY;
    const current = categoriesByFrente.get(frenteKey);
    if (current) current.push(category);
    else categoriesByFrente.set(frenteKey, [category]);
  });

  const configuredFrenteKeys = frentes
    .map((frente) => frente.id)
    .filter((key) => categoriesByFrente.has(key));
  const configuredFrenteKeySet = new Set(configuredFrenteKeys);
  const remainingFrenteKeys = [...categoriesByFrente.keys()].filter(
    (key) => !configuredFrenteKeySet.has(key),
  );
  const frenteById = new Map(frentes.map((frente) => [frente.id, frente]));

  return [...configuredFrenteKeys, ...remainingFrenteKeys].map((key) => {
    const frente = frenteById.get(key);
    const categories = categoriesByFrente.get(key) ?? [];

    return {
      id: key,
      key,
      label: frente?.label || (key === NO_FRENTE_KEY ? 'Sem frente de atuação' : 'Outra frente de atuação'),
      color: frente?.color,
      icon: frente?.icon,
      ticketCount: categories.reduce((total, category) => total + category.tickets.length, 0),
      categories,
    };
  });
}
