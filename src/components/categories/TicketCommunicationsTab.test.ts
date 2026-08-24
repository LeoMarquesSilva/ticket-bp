import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/ticketCommunicationSettingsService', () => ({
  TicketCommunicationSettingsService: { get: vi.fn(async () => ({})), save: vi.fn() },
}));

import TicketCommunicationsTab from './TicketCommunicationsTab';

describe('TicketCommunicationsTab', () => {
  it('oferece as três comunicações, editor seguro e preview do e-mail', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Chamado finalizado');
    expect(html).toContain('Aguardando resposta');
    expect(html).toContain('Avaliação pendente');
    expect(html).toContain('Assunto do e-mail');
    expect(html).toContain('Texto principal');
    expect(html).toContain('Texto do botão');
    expect(html).toContain('Prévia do destinatário');
    expect(html).toContain('iframe');
    expect(html).not.toContain('Editar HTML');
  });
});
