import { describe, expect, it } from 'vitest';
import {
  buildNotificationContent,
  EMAIL_TEMPLATE_DEFAULTS,
  escapeHtml,
  normalizeEmailTemplateOverrides,
  normalizeAppPublicUrl,
} from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';

const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso ao sistema',
};
const requester = { name: 'Ana' };

describe('buildNotificationContent', () => {
  it('renderiza um e-mail Responsum completo e compatível com clientes corporativos', () => {
    const content = buildNotificationContent({
      type: 'resolved_feedback_invite',
      ticket,
      requester,
      appBaseUrl: 'https://responsum.example',
    });

    expect(content.email.html).toContain('role="presentation"');
    expect(content.email.html).toContain('RESPONSUM');
    expect(content.email.html).toContain('#F69F19');
    expect(content.email.html).toContain('Avaliar atendimento');
    expect(content.email.html).toContain('Abrir chamado no Responsum');
    expect(content.email.html).toContain('Caso o botão não funcione');
    expect(content.email.html).toContain('width:100%');
    expect(content.email.text).toContain('RESPONSUM | AVISO DE CHAMADO');
  });

  it('aplica somente textos saneados e mantém URL e destinatário fora da configuração', () => {
    const overrides = normalizeEmailTemplateOverrides({
      awaiting_requester: {
        subject: 'Precisamos de você',
        reason: 'Responda para continuarmos <agora>.',
        action: 'Continuar atendimento',
        ticketUrl: 'https://malicioso.example',
      },
    });
    const content = buildNotificationContent({
      type: 'awaiting_requester', ticket, requester,
      appBaseUrl: 'https://responsum.example', emailTemplateOverrides: overrides,
    });

    expect(content.email.subject).toBe('Precisamos de você');
    expect(content.email.html).toContain('Responda para continuarmos &lt;agora&gt;.');
    expect(content.email.html).toContain('Continuar atendimento');
    expect(content.email.html).not.toContain('malicioso.example');
  });

  it('descarta configuração inválida por campo e preserva os defaults versionados', () => {
    const overrides = normalizeEmailTemplateOverrides({
      resolved_feedback_invite: {
        subject: 'x'.repeat(141),
        reason: '',
        action: 'y'.repeat(49),
      },
      unknown: { subject: 'não usar' },
    });

    expect(overrides).toEqual({});
    expect(EMAIL_TEMPLATE_DEFAULTS.awaiting_feedback.action).toBe('Avaliar atendimento');
  });

  it('cria link de avaliação para convite e lembrete de feedback', () => {
    const content = buildNotificationContent({
      type: 'awaiting_feedback',
      ticket: { ...ticket, title: 'Acesso <urgente>' },
      requester: { name: 'Ana & Cia' },
      appBaseUrl: 'https://responsum.example/',
    });

    expect(content.teams.ticketUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111?showFeedback=true');
    expect(content.teams.label).toBe('Avaliar atendimento');
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

    expect(content.teams.ticketUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111');
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

describe('normalizeAppPublicUrl', () => {
  it('preserva uma base path e remove barras redundantes', () => {
    expect(normalizeAppPublicUrl('https://responsum.example/helpdesk///'))
      .toBe('https://responsum.example/helpdesk');
  });

  it.each([
    'http://responsum.example',
    'https://user@responsum.example',
    'https://responsum.example/?source=wrong',
    'https://responsum.example/#wrong',
  ])('rejeita base pública inválida: %s', (value) => {
    expect(() => normalizeAppPublicUrl(value)).toThrow('APP_PUBLIC_URL');
  });
});
