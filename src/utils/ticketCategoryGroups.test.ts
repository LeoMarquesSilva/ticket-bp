import { describe, expect, it } from 'vitest';
import {
  expandVisibleTicketCategories,
  expandVisibleTicketFrentes,
  groupTicketsByCategory,
  groupTicketsByFrente,
  resolveFrenteIconName,
  shouldUseFrenteHierarchy,
  getTicketListFilterExpansion,
  toggleFrenteCategoryExpansion,
  getTicketCategoryColumnCount,
  groupTicketCategoryRows,
} from './ticketCategoryGroups';
import type { CategoriesConfigMap } from './ticketFilterUtils';

const categoriesConfig: CategoriesConfigMap = {
  trabalhista: { label: 'Trabalhista', subcategories: [] },
  societario: { label: 'Societário e Contratos', subcategories: [] },
};

describe('groupTicketsByCategory', () => {
  it('agrupa na ordem oficial das categorias e preserva a ordem dos tickets', () => {
    const tickets = [
      { id: 'soc-1', category: 'societario' },
      { id: 'trab-1', category: 'trabalhista' },
      { id: 'soc-2', category: 'societario' },
    ];

    const groups = groupTicketsByCategory(tickets, categoriesConfig);

    expect(groups.map(({ key, label, tickets: groupedTickets }) => ({
      key,
      label,
      ticketIds: groupedTickets.map((ticket) => ticket.id),
    }))).toEqual([
      { key: 'trabalhista', label: 'Trabalhista', ticketIds: ['trab-1'] },
      { key: 'societario', label: 'Societário e Contratos', ticketIds: ['soc-1', 'soc-2'] },
    ]);
  });

  it('mantém tickets de categorias legadas ou ausentes em grupos compreensíveis', () => {
    const tickets = [
      { id: 'legacy-1', category: 'demanda_legacy' },
      { id: 'missing-1', category: '' },
    ];

    const groups = groupTicketsByCategory(tickets, categoriesConfig);

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: 'demanda_legacy', label: 'Demanda legacy' },
      { key: '__uncategorized__', label: 'Sem categoria' },
    ]);
  });

  it('não cria seções vazias quando nenhum ticket passou pelos filtros', () => {
    expect(groupTicketsByCategory([], categoriesConfig)).toEqual([]);
  });
});

describe('expandVisibleTicketCategories', () => {
  it('preserva categorias abertas e inclui cada categoria visível uma única vez', () => {
    expect(expandVisibleTicketCategories(
      ['trabalhista'],
      [
        { category: 'societario' },
        { category: 'societario' },
        { category: '' },
      ],
    )).toEqual(['trabalhista', 'societario', '__uncategorized__']);
  });
});

describe('expandVisibleTicketFrentes', () => {
  it('inclui as frentes dos tickets visíveis e preserva as já abertas', () => {
    const config: CategoriesConfigMap = {
      contratos: { label: 'Contratos', tagId: 'societario', subcategories: [] },
      geral: { label: 'Geral', subcategories: [] },
    };

    expect(expandVisibleTicketFrentes(
      ['trabalhista'],
      [{ category: 'contratos' }, { category: 'geral' }],
      config,
    )).toEqual(['trabalhista', 'societario', '__no_frente__']);
  });
});

describe('groupTicketsByFrente', () => {
  it('organiza frentes na ordem oficial e mantém as categorias dentro de cada uma', () => {
    const config: CategoriesConfigMap = {
      contratos: { label: 'Contratos', tagId: 'societario', subcategories: [] },
      reclamacoes: { label: 'Reclamações', tagId: 'trabalhista', subcategories: [] },
      consultivo: { label: 'Consultivo', tagId: 'trabalhista', subcategories: [] },
      geral: { label: 'Geral', subcategories: [] },
    };
    const tickets = [
      { id: 'contrato-1', category: 'contratos' },
      { id: 'reclamacao-1', category: 'reclamacoes' },
      { id: 'consultivo-1', category: 'consultivo' },
      { id: 'geral-1', category: 'geral' },
    ];

    const groups = groupTicketsByFrente(tickets, config, [
      { id: 'trabalhista', label: 'Trabalhista', color: '#2563eb', icon: 'users' },
      { id: 'societario', label: 'Societário', color: '#f97316' },
    ]);

    expect(groups.map((group) => ({
      key: group.key,
      label: group.label,
      icon: group.icon,
      ticketCount: group.ticketCount,
      categories: group.categories.map((category) => category.label),
    }))).toEqual([
      {
        key: 'trabalhista',
        label: 'Trabalhista',
        icon: 'users',
        ticketCount: 2,
        categories: ['Reclamações', 'Consultivo'],
      },
      {
        key: 'societario',
        label: 'Societário',
        icon: undefined,
        ticketCount: 1,
        categories: ['Contratos'],
      },
      {
        key: '__no_frente__',
        label: 'Sem frente de atuação',
        icon: undefined,
        ticketCount: 1,
        categories: ['Geral'],
      },
    ]);
  });
});

describe('resolveFrenteIconName', () => {
  it('respeita o ícone cadastrado e normaliza aliases conhecidos', () => {
    expect(resolveFrenteIconName('monitor', 'trabalhista', 'Trabalhista')).toBe('monitor');
    expect(resolveFrenteIconName('balança', 'societario', 'Societário')).toBe('scale');
  });

  it('infere um ícone semântico pela frente e mantém fallback seguro', () => {
    expect(resolveFrenteIconName(undefined, 'trabalhista', 'Frente Trabalhista')).toBe('users');
    expect(resolveFrenteIconName(undefined, 'societario', 'Frente Societária')).toBe('building-2');
    expect(resolveFrenteIconName(undefined, 'lab', 'LAB')).toBe('flask-conical');
    expect(resolveFrenteIconName(undefined, 'controladoria', 'Controladoria')).toBe('clipboard-check');
    expect(resolveFrenteIconName(undefined, 'mkt', 'MKT')).toBe('megaphone');
    expect(resolveFrenteIconName('desconhecido', 'tributario', 'Tributário')).toBe('landmark');
    expect(resolveFrenteIconName(undefined, 'outra', 'Outra frente')).toBe('briefcase');
  });
});

describe('shouldUseFrenteHierarchy', () => {
  it('habilita o nível de frente para visão global ou acesso a várias frentes', () => {
    expect(shouldUseFrenteHierarchy(true, [])).toBe(true);
    expect(shouldUseFrenteHierarchy(false, ['frente-1', 'frente-2'])).toBe(true);
    expect(shouldUseFrenteHierarchy(false, ['frente-1'])).toBe(false);
  });
});

describe('getTicketListFilterExpansion', () => {
  it('abre somente a frente ao filtrar uma frente, sem abrir seus tickets', () => {
    expect(getTicketListFilterExpansion('', 'all', 'lab')).toEqual({
      expandFrentes: true,
      expandCategories: false,
    });
  });

  it('abre o caminho até os tickets ao buscar ou selecionar uma categoria', () => {
    expect(getTicketListFilterExpansion('contrato', 'all', 'all')).toEqual({
      expandFrentes: true,
      expandCategories: true,
    });
    expect(getTicketListFilterExpansion('', 'contratos', 'lab')).toEqual({
      expandFrentes: true,
      expandCategories: true,
    });
  });

  it('não muda a expansão quando não há filtro de navegação', () => {
    expect(getTicketListFilterExpansion('  ', 'all', 'all')).toEqual({
      expandFrentes: false,
      expandCategories: false,
    });
  });
});

describe('toggleFrenteCategoryExpansion', () => {
  it('expande apenas as categorias da frente e preserva as outras abertas', () => {
    const current = ['externa', 'categoria-1'];
    expect(toggleFrenteCategoryExpansion(current, ['categoria-1', 'categoria-2']))
      .toEqual(['externa', 'categoria-1', 'categoria-2']);
    expect(current).toEqual(['externa', 'categoria-1']);
  });

  it('recolhe apenas as categorias da frente quando todas estão abertas', () => {
    expect(toggleFrenteCategoryExpansion(
      ['externa', 'categoria-1', 'categoria-2'],
      ['categoria-1', 'categoria-2'],
    )).toEqual(['externa']);
  });

  it('não altera outras categorias quando a frente não tem resultados', () => {
    expect(toggleFrenteCategoryExpansion(['externa'], [])).toEqual(['externa']);
  });
});

describe('layout das categorias', () => {
  it('limita a grade à largura disponível e mantém uma coluna com o chat', () => {
    expect(getTicketCategoryColumnCount(390, false)).toBe(1);
    expect(getTicketCategoryColumnCount(575, false)).toBe(1);
    expect(getTicketCategoryColumnCount(576, false)).toBe(2);
    expect(getTicketCategoryColumnCount(991, false)).toBe(2);
    expect(getTicketCategoryColumnCount(992, false)).toBe(3);
    expect(getTicketCategoryColumnCount(1600, true)).toBe(1);
  });

  it('mantém as categorias na ordem original e agrupa a última linha incompleta', () => {
    expect(groupTicketCategoryRows(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3))
      .toEqual([['a', 'b', 'c'], ['d', 'e', 'f'], ['g']]);
    expect(groupTicketCategoryRows(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
    expect(groupTicketCategoryRows([], 1)).toEqual([]);
  });
});
