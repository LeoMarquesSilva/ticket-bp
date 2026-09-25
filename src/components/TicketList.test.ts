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

    expect(html).toContain('3 tickets em 2 categorias');
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
      }),
    );

    expect(html).toContain('2 tickets em 2 frentes de atuação e 2 categorias');
    expect(html).toContain('Frente Trabalhista');
    expect(html).toContain('Contencioso Trabalhista');
    expect(html).toContain('Frente Societária');
    expect(html).toContain('aria-label="Recolher categorias de Frente Trabalhista"');
    expect(html).not.toContain('aria-label="Expandir categorias de Frente Societária"');
    expect(html).toContain('aria-label="1 categoria"');
    expect(html).toContain('aria-label="1 ticket"');
    expect(html).toContain('lucide-users');
    expect(html).toContain('lucide-building2');
    expect(html).toContain('<article>trab-1</article>');
    expect(html).not.toContain('<article>soc-1</article>');
  });
});
