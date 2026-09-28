import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TicketList from './TicketList';
import type { Ticket } from '@/types';

function makeTicket(id: string, category: string): Ticket {
  return {
    id,
    category,
    title: `Ticket ${id}`,
    description: 'Descrição',
    priority: 'medium',
    status: 'open',
    createdBy: 'user-1',
    createdByName: 'Usuário',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  };
}

describe('TicketList agrupada por categoria', () => {
  it('mostra contadores e renderiza cards somente das categorias expandidas', () => {
    const tickets = [
      makeTicket('trab-1', 'trabalhista'),
      makeTicket('trab-2', 'trabalhista'),
      makeTicket('soc-1', 'societario'),
    ];

    const html = renderToStaticMarkup(
      React.createElement(TicketList, {
        filteredTickets: tickets,
        tickets,
        categoriesConfig: {
          trabalhista: { label: 'Trabalhista', subcategories: [] },
          societario: { label: 'Societário e Contratos', subcategories: [] },
        },
        expandedCategoryKeys: ['trabalhista'],
        onExpandedCategoryKeysChange: () => undefined,
        renderTicketCard: (ticket: Ticket) => React.createElement('article', null, ticket.id),
      }),
    );

    expect(html).toContain('Todos');
    expect(html).toContain('aria-label="Ordenar tickets"');
    expect(html).toContain('Trabalhista');
    expect(html).toContain('2 tickets');
    expect(html).toContain('Societário e Contratos');
    expect(html).toContain('1 ticket');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('<article>trab-1</article>');
    expect(html).toContain('<article>trab-2</article>');
    expect(html).not.toContain('<article>soc-1</article>');
  });

  it('mostra frentes acima das categorias para usuários com visão ampla', () => {
    const tickets = [
      makeTicket('trab-1', 'trabalhista_contencioso'),
      makeTicket('soc-1', 'contratos'),
    ];

    const html = renderToStaticMarkup(
      React.createElement(TicketList, {
        filteredTickets: tickets,
        tickets,
        categoriesConfig: {
          trabalhista_contencioso: {
            label: 'Contencioso Trabalhista',
            tagId: 'trabalhista',
            subcategories: [],
          },
          contratos: {
            label: 'Contratos',
            tagId: 'societario',
            subcategories: [],
          },
        },
        frentes: [
          { id: 'trabalhista', label: 'Frente Trabalhista', color: '#2563eb', icon: 'users' },
          { id: 'societario', label: 'Frente Societária', color: '#f97316', icon: 'building-2' },
        ],
        groupByFrente: true,
        expandedFrenteKeys: ['trabalhista'],
        onExpandedFrenteKeysChange: () => undefined,
        expandedCategoryKeys: ['trabalhista_contencioso'],
        onExpandedCategoryKeysChange: () => undefined,
        renderTicketCard: (ticket: Ticket) => React.createElement('article', null, ticket.id),
        unreadCounts: { 'soc-1': 2 },
      }),
    );

    expect(html).toContain('aria-label="Filtros rápidos"');
    expect(html).toContain('Não lidas');
    expect(html).not.toContain('Aguardando resposta');
    expect(html).toContain('Frente Trabalhista');
    expect(html).toContain('Contencioso Trabalhista');
    expect(html).toContain('Frente Societária');
    expect(html).not.toContain('Categorias desta frente');
    expect(html).not.toContain('categorias de Frente');
    expect(html).toContain('1 ticket com mensagem não lida');
    expect(html).toContain('Sem mensagens não lidas');
    expect(html).toContain('lucide-users');
    expect(html).toContain('lucide-building2');
    expect(html).toContain('<article>trab-1</article>');
    expect(html).not.toContain('<article>soc-1</article>');
  });
});
