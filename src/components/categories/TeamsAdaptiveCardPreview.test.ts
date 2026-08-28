import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildNotificationContent } from '../../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';
import { TeamsAdaptiveCardPreview } from './TeamsAdaptiveCardPreview';

describe('TeamsAdaptiveCardPreview', () => {
  it('renderiza o Adaptive Card enviado, no visual do chat do Teams', () => {
    const content = buildNotificationContent({
      type: 'resolved_feedback_invite',
      ticket: { id: 'exemplo-1234', title: 'Acesso ao sistema de indicadores' },
      requester: { name: 'Leonardo' },
      appBaseUrl: 'https://responsum.example',
    });
    const html = renderToStaticMarkup(
      React.createElement(TeamsAdaptiveCardPreview, {
        card: content.teams.card,
        chatHtml: content.teams.chatHtml,
      }),
    );

    expect(html).toContain('RESPONSUM');
    expect(html).toContain('CHAMADO FINALIZADO');
    expect(html).toContain('Atendimento concluído');
    expect(html).toContain('Olá, Leonardo.');
    expect(html).toContain('Acesso ao sistema de indicadores');
    expect(html).toContain('Avaliar atendimento');
    expect(html).toContain('como o destinatário vê no Teams');
    expect(html).toContain('bg-[#5B5FC7]');
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('linear-gradient');
  });
});
