import { describe, expect, it } from 'vitest';
import {
  buildNotificationContent,
  escapeHtml,
} from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';

const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso ao sistema',
};
const requester = { name: 'Ana' };

describe('buildNotificationContent', () => {
  it('cria link de avaliação para convite e lembrete de feedback', () => {
    const content = buildNotificationContent({
      type: 'awaiting_feedback',
      ticket: { ...ticket, title: 'Acesso <urgente>' },
      requester: { name: 'Ana & Cia' },
      appBaseUrl: 'https://responsum.example/',
    });

    expect(content.teams.webUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111?showFeedback=true');
    expect(content.email.html).toContain('Acesso &lt;urgente&gt;');
    expect(content.email.html).toContain('Ana &amp; Cia');
    expect(content.email.html).not.toContain('Acesso <urgente>');
  });

  it('usa o chamado sem showFeedback no lembrete de resposta', () => {
    const content = buildNotificationContent({
      type: 'awaiting_requester',
      ticket,
      requester,
      appBaseUrl: 'https://responsum.example',
    });

    expect(content.teams.webUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111');
    expect(content.email.subject).toBe('Seu chamado aguarda uma resposta: Acesso ao sistema');
    expect(content.email.text).toContain('Responder chamado: https://responsum.example/tickets/11111111-1111-1111-1111-111111111111');
  });

  it.each([
    ['resolved_feedback_invite', 'Avalie o atendimento: Acesso ao sistema', 'Seu chamado foi finalizado.', 'Avaliar atendimento'],
    ['awaiting_requester', 'Seu chamado aguarda uma resposta: Acesso ao sistema', 'O suporte aguarda sua resposta há mais de 48 horas.', 'Responder chamado'],
    ['awaiting_feedback', 'Avaliação pendente: Acesso ao sistema', 'Seu chamado foi finalizado há mais de 72 horas e ainda não foi avaliado.', 'Avaliar atendimento'],
  ])('cria o conteúdo específico de %s', (type, subject, reason, action) => {
    const content = buildNotificationContent({ type, ticket, requester, appBaseUrl: 'https://responsum.example' });

    expect(content.email.subject).toBe(subject);
    expect(content.email.text).toContain(reason);
    expect(content.email.text).toContain(action);
    expect(content.teams).toMatchObject({ topic: ticket.title, previewText: reason });
  });
});

it('escapa todos os caracteres especiais em HTML', () => {
  expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
});
