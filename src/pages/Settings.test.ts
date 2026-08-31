import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({
    canAccess: true,
    loadData: vi.fn(),
    categories: [],
    sortedTagGroups: [],
    tags: [],
    supportUsers: [],
    getRoleLabel: (role: string) => role,
    editingSubcategory: null,
    setEditingSubcategory: vi.fn(),
    editSubcategoryLoading: false,
    handleEditSubcategory: vi.fn(),
  }),
}));
vi.mock('@/hooks/useEvolutionApi', () => ({
  useEvolutionApi: () => ({
    whatsappFrenteFilter: 'all',
    loadInstanceName: vi.fn(),
    loadEvolutionInstances: vi.fn(),
    loadStaleTicketSettings: vi.fn(),
    loadUnansweredTickets: vi.fn(),
  }),
}));
vi.mock('@/components/categories/TicketCommunicationsTab', () => ({
  default: () => 'Comunicações carregadas',
}));
vi.mock('@/components/categories/TicketCommunicationScheduleTab', () => ({
  default: () => 'Prazos carregados',
}));
vi.mock('@/components/categories/WhatsAppTab', () => ({
  default: () => 'WhatsApp carregado',
}));
vi.mock('@/components/categories/SubcategoryFormDialog', () => ({
  default: () => null,
}));

import Settings from './Settings';

describe('Settings', () => {
  it('mostra Configurações com Comunicações, prazos e WhatsApp, sem taxonomia', () => {
    const html = renderToStaticMarkup(React.createElement(Settings));

    expect(html).toContain('Configurações');
    expect(html).toContain('Comunicações');
    expect(html).toContain('Quando enviar');
    expect(html).toContain('WhatsApp');
    expect(html).toContain('e-mail, Teams e WhatsApp');
    expect(html).not.toContain('Frentes de Atuação');
    expect(html).not.toContain('Nova categoria');
  });
});
